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


# ---------------------------------------------------------------- 時間帯モード


def hourly_base(**overrides):
    data = {
        "period": {"start": "2027-01-04", "end": "2027-01-10"},
        "hourly": {
            "min_hours": 4,
            "max_hours": 8,
            "business_hours": {
                "default": {"open": "10:00", "close": "20:00"},
                "weekdays": {"水": "定休日", "土": {"open": "09:00", "close": "21:00"}},
            },
            "demand": {"default": [{"from": "11:00", "to": "14:00", "count": 2}]},
        },
        "staff": [{"name": n} for n in ["A", "B", "C", "D", "E"]],
        "rules": {"time_limit_seconds": 2},
    }
    data.update(overrides)
    return data


def test_hourly_business_hours_and_closed_day():
    p = parse_problem(hourly_base())
    assert p.business_hours[dt.date(2027, 1, 6)] is None            # 水曜 定休日
    assert p.business_hours[dt.date(2027, 1, 9)] == (9 * 60, 21 * 60)  # 土曜
    r = solve(p)
    assert r.ok and r.shortages == []
    assert not [k for k in r.assignments if k[1] == dt.date(2027, 1, 6)]
    for (n, d), c in r.assignments.items():
        sh = p.shift_by_code(c)
        o, cl = p.business_hours[d]
        assert o <= sh.start_min and sh.end_min <= cl
        assert 4 * 60 <= sh.minutes <= 8 * 60


def test_hourly_demand_is_covered():
    p = parse_problem(hourly_base())
    r = solve(p)
    for (d, t), need in p.slot_demand.items():
        n = sum(
            1 for (_, dd), c in r.assignments.items()
            if dd == d and p.shift_by_code(c).start_min <= t < p.shift_by_code(c).end_min
        )
        assert n >= need


def test_hourly_staff_time_limits():
    data = hourly_base()
    data["staff"][0].update({"available_from": "15:00"})
    data["staff"][1].update({"max_hours_per_day": 4})
    p = parse_problem(data)
    r = solve(p)
    for (n, d), c in r.assignments.items():
        sh = p.shift_by_code(c)
        if n == "A":
            assert sh.start_min >= 15 * 60
        if n == "B":
            assert sh.minutes <= 4 * 60


def test_hourly_ng_time_range():
    data = hourly_base(requests=[{"name": "A", "date": "2027-01-05", "type": "NG", "from": "10:00", "to": "15:00"}])
    p = parse_problem(data)
    r = solve(p)
    c = r.assignments.get(("A", dt.date(2027, 1, 5)))
    if c:
        assert p.shift_by_code(c).start_min >= 15 * 60


def test_hourly_example_file_solves():
    p = load_problem(ROOT / "examples" / "hourly.yaml")
    r = solve(p)
    assert r.ok and r.shortages == []


def test_hourly_bad_business_hours():
    data = hourly_base()
    data["hourly"]["business_hours"]["default"] = {"open": "10:30", "close": "20:00"}
    with pytest.raises(ConfigError, match="区切り"):
        parse_problem(data)


@pytest.mark.parametrize("maker", [base, hourly_base])
def test_html_output(tmp_path, maker):
    from kumishift.html import write_html

    p = parse_problem(maker())
    out = tmp_path / "s.html"
    write_html(p, solve(p), out, title="テスト<>")
    html = out.read_text(encoding="utf-8")
    assert "<title>テスト&lt;&gt;</title>" in html
    assert '"assign"' in html


def test_want_day_without_shift():
    data = base(staff=[{"name": n, "max_days": 3} for n in ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]],
                requests=[{"name": "J", "date": "2027-01-07", "type": "希望"}])
    r = solve(parse_problem(data))
    assert ("J", dt.date(2027, 1, 7)) in r.assignments


# ---------------------------------------------------------------- 休憩・中休み・固定


def test_break_rules_reduce_work_hours():
    data = hourly_base()
    data["rules"]["breaks"] = [{"over_hours": 6, "minutes": 45}, {"over_hours": 8, "minutes": 60}]
    p = parse_problem(data)
    p.shifts.append(type(p.shifts[0])(code="t9", name="t9", start="10:00", end="19:00"))
    assert p.break_minutes("10-14") == 0          # 4時間: 休憩なし
    assert p.break_minutes("t9") == 60            # 9時間: 60分
    p2 = parse_problem(data)
    assert p2.work_minutes("10-17") == 7 * 60 - 45  # 7時間: 45分


def test_weekly_limit_uses_work_minutes():
    data = hourly_base()
    data["hourly"]["min_hours"] = 8
    data["rules"]["breaks"] = [{"over_hours": 6, "minutes": 60}]
    for st in data["staff"]:
        st["max_hours_per_week"] = 14  # 実働7時間 × 2日まで
    p = parse_problem(data)
    r = solve(p)
    for st in ["A", "B", "C", "D", "E"]:
        assert sum(1 for (n, _), _c in r.assignments.items() if n == st) <= 2


def test_mid_day_closure():
    data = hourly_base()
    data["hourly"]["business_hours"]["default"] = {
        "open": "10:00", "close": "21:00", "breaks": [{"from": "15:00", "to": "17:00"}]
    }
    data["hourly"]["demand"] = {"default": [{"from": "17:00", "to": "21:00", "count": 2}]}
    p = parse_problem(data)
    d = dt.date(2027, 1, 4)
    assert 15 * 60 not in p.slots_of(d) and 16 * 60 not in p.slots_of(d)
    assert (d, 15 * 60) not in p.slot_demand
    r = solve(p)
    assert r.ok and r.shortages == []
    for (n, dd), c in r.assignments.items():
        sh = p.shift_by_code(c)
        if p.business_hours[dd] == (600, 1260):
            assert sh.end_min <= 15 * 60 or sh.start_min >= 17 * 60


def test_mid_day_closure_must_be_inside_hours():
    data = hourly_base()
    data["hourly"]["business_hours"]["default"] = {
        "open": "10:00", "close": "20:00", "breaks": [{"from": "09:00", "to": "11:00"}]
    }
    with pytest.raises(ConfigError, match="中休み"):
        parse_problem(data)


def test_fixed_shift_overrides_conditions():
    data = hourly_base(requests=[
        # A は月曜しか入れない設定だが、水曜（定休日）以外の木曜に手で 10:30-14:00 を入れる
        {"name": "A", "date": "2027-01-07", "type": "固定", "from": "10:00", "to": "13:00"},
        {"name": "B", "date": "2027-01-04", "type": "固定休み"},
    ])
    data["staff"][0]["weekdays"] = ["月"]
    data["hourly"]["min_hours"] = 4  # 3時間の勤務は自動では作られない
    p = parse_problem(data)
    r = solve(p)
    assert r.assignments[("A", dt.date(2027, 1, 7))] == "10-13"
    assert ("B", dt.date(2027, 1, 4)) not in r.assignments


def test_fixed_conflict_is_reported():
    from fastapi.testclient import TestClient
    from kumishift.api import app

    data = hourly_base(requests=[
        {"name": "A", "date": f"2027-01-0{d}", "type": "固定", "from": "10:00", "to": "14:00"}
        for d in (4, 5, 7, 8)
    ])
    data["staff"][0]["max_days"] = 2
    res = TestClient(app).post("/api/solve", json=data)
    assert res.status_code == 422
    assert "手で直した勤務" in res.json()["detail"]
