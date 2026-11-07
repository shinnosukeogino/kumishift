import datetime as dt
from pathlib import Path

import pytest

from kumishift import ConfigError, load_problem, parse_problem, solve
from kumishift.output import to_dict

ROOT = Path(__file__).resolve().parents[1]


def base(**overrides):
    data = {
        "period": {"start": "2027-01-04", "end": "2027-01-17"},  # 月曜から2週間
        "shifts": [
            {"code": "早", "start": "09:00", "end": "15:00"},
            {"code": "遅", "start": "16:00", "end": "22:00"},
        ],
        "staff": [{"name": n} for n in ["A", "B", "C", "D"]],
        "demand": {"default": {"早": 1, "遅": 1}},
        "rules": {"time_limit_seconds": 5},
    }
    data.update(overrides)
    return data


def days_of(result, name):
    return sorted(d for (n, d) in result.assignments if n == name)


def test_example_file_solves():
    p = load_problem(ROOT / "examples" / "basic.yaml")
    r = solve(p)
    assert r.ok
    assert r.shortages == []


def test_demand_is_met_and_one_shift_per_day():
    r = solve(parse_problem(base()))
    assert r.ok and r.shortages == []
    seen = set()
    for (n, d) in r.assignments:
        assert (n, d) not in seen
        seen.add((n, d))


def test_hope_off_is_respected():
    p = parse_problem(base(requests=[{"name": "A", "date": "2027-01-06", "type": "休み"}]))
    r = solve(p)
    assert ("A", dt.date(2027, 1, 6)) not in r.assignments


def test_ng_shift_is_respected():
    p = parse_problem(base(requests=[{"name": "A", "date": "2027-01-06", "type": "NG", "shift": "早"}]))
    r = solve(p)
    assert r.assignments.get(("A", dt.date(2027, 1, 6))) != "早"


def test_weekday_availability():
    data = base()
    data["staff"][0]["weekdays"] = ["土", "日"]
    r = solve(parse_problem(data))
    assert all(d.weekday() >= 5 for d in days_of(r, "A"))


def test_allowed_shifts():
    data = base()
    data["staff"][0]["shifts"] = ["遅"]
    r = solve(parse_problem(data))
    assert all(c == "遅" for (n, _), c in r.assignments.items() if n == "A")


def test_max_consecutive():
    data = base(staff=[{"name": "A", "max_consecutive": 3}, {"name": "B"}, {"name": "C"}])
    data["demand"] = {"default": {"早": 1, "遅": 1}}
    r = solve(parse_problem(data))
    days = set(days_of(r, "A"))
    p = parse_problem(data)
    for i in range(len(p.dates) - 3):
        assert sum(p.dates[i + j] in days for j in range(4)) <= 3


def test_forbidden_sequence():
    data = base(rules={"forbidden_sequences": [["遅", "早"]], "time_limit_seconds": 5})
    r = solve(parse_problem(data))
    for (n, d), c in r.assignments.items():
        if c == "遅":
            assert r.assignments.get((n, d + dt.timedelta(days=1))) != "早"


def test_max_hours_per_week():
    data = base()
    for s in data["staff"]:
        s["max_hours_per_week"] = 18  # 6時間 × 3日まで
    r = solve(parse_problem(data))
    for s in ["A", "B", "C", "D"]:
        week1 = [d for d in days_of(r, s) if d <= dt.date(2027, 1, 10)]
        assert len(week1) <= 3


def test_shortage_is_reported_not_infeasible():
    data = base(staff=[{"name": "A"}])  # 1人では毎日2枠を埋められない
    r = solve(parse_problem(data))
    assert r.ok
    assert len(r.shortages) > 0


def test_demand_override_order():
    data = base(
        holidays=["2027-01-11"],
        demand={
            "default": {"早": 1, "遅": 1},
            "weekdays": {"月": {"早": 2}, "祝": {"早": 3}},
            "dates": {"2027-01-18": {"早": 0}},
        },
        period={"start": "2027-01-04", "end": "2027-01-18"},
    )
    p = parse_problem(data)
    assert p.demand[(dt.date(2027, 1, 4), "早")] == 2   # 月曜
    assert p.demand[(dt.date(2027, 1, 11), "早")] == 3  # 祝日の月曜
    assert p.demand[(dt.date(2027, 1, 18), "早")] == 0  # 日付指定
    assert p.demand[(dt.date(2027, 1, 5), "早")] == 1   # 通常


def test_overnight_shift_minutes():
    p = parse_problem(base(shifts=[{"code": "夜", "start": "22:00", "end": "07:00"}],
                           demand={"default": {"夜": 1}}))
    assert p.shift_by_code("夜").minutes == 9 * 60


def test_unquoted_yaml_time(tmp_path):
    f = tmp_path / "c.yaml"
    f.write_text(
        "period: {start: 2027-01-04, end: 2027-01-05}\n"
        "shifts: [{code: 遅, start: 13:00, end: 22:00}]\n"
        "staff: [{name: A}]\n",
        encoding="utf-8",
    )
    assert load_problem(f).shift_by_code("遅").minutes == 9 * 60


@pytest.mark.parametrize(
    "patch, message",
    [
        ({"staff": [{"name": "A", "shifts": ["夜"]}]}, "勤務コード"),
        ({"requests": [{"name": "Z", "date": "2027-01-05"}]}, "staff にいない"),
        ({"period": {"start": "2027-01-10", "end": "2027-01-01"}}, "前"),
    ],
)
def test_config_errors_are_friendly(patch, message):
    with pytest.raises(ConfigError, match=message):
        parse_problem(base(**patch))


def test_json_output_shape():
    p = parse_problem(base())
    d = to_dict(p, solve(p))
    assert d["status"] in ("最適", "実行可能")
    assert {"name", "date", "shift"} <= set(d["assignments"][0])
