"""設定ファイル（YAML / JSON / dict）を読み込んで、ソルバーが使うデータに変換する。"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

WEEKDAY_KEYS = {
    "月": 0, "火": 1, "水": 2, "木": 3, "金": 4, "土": 5, "日": 6,
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
}
WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"]
HOLIDAY_KEYS = {"祝", "祝日", "holiday"}

REQUEST_OFF = {"休み", "希望休", "off"}
REQUEST_WANT = {"希望", "want"}
REQUEST_NG = {"NG", "ng", "不可"}


class ConfigError(ValueError):
    """設定ファイルの内容に問題があるときのエラー。"""


@dataclass
class ShiftType:
    code: str
    name: str
    start: str
    end: str

    @property
    def minutes(self) -> int:
        """勤務時間（分）。終了が開始より早ければ日またぎとして扱う。"""
        s = _parse_hhmm(self.start)
        e = _parse_hhmm(self.end)
        if e <= s:
            e += 24 * 60
        return e - s


@dataclass
class Staff:
    name: str
    shifts: list[str]
    weekdays: set[int]
    min_days: int | None = None
    max_days: int | None = None
    max_consecutive: int | None = None
    max_hours_per_week: float | None = None
    fair: bool = True


@dataclass
class Request:
    name: str
    date: dt.date
    kind: str  # "off" | "want" | "ng"
    shift: str | None = None


@dataclass
class Rules:
    forbidden_sequences: list[tuple[str, str]] = field(default_factory=list)
    max_consecutive: int | None = 6
    hope_off_is_hard: bool = True
    time_limit_seconds: float = 10.0


@dataclass
class Weights:
    shortage: int = 1000
    over: int = 10
    min_days: int = 100
    hope_off: int = 200
    preference: int = 5
    fairness: int = 20
    weekend_fairness: int = 10


@dataclass
class Problem:
    dates: list[dt.date]
    shifts: list[ShiftType]
    staff: list[Staff]
    demand: dict[tuple[dt.date, str], int]
    requests: list[Request]
    holidays: set[dt.date]
    rules: Rules
    weights: Weights

    def shift_by_code(self, code: str) -> ShiftType:
        for s in self.shifts:
            if s.code == code:
                return s
        raise KeyError(code)

    def is_weekend(self, d: dt.date) -> bool:
        return d.weekday() >= 5 or d in self.holidays


# ---------------------------------------------------------------- 読み込み


def load_problem(path: str | Path) -> Problem:
    """YAML または JSON の設定ファイルを読み込む。"""
    path = Path(path)
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        import json

        data = json.loads(text)
    else:
        import yaml

        data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise ConfigError("設定ファイルの中身が空か、形式が正しくありません。")
    return parse_problem(data)


def parse_problem(data: dict[str, Any]) -> Problem:
    """dict（YAML / JSON を読んだもの）から Problem を作る。"""
    period = _require(data, "period", "期間（period）")
    start = _to_date(_require(period, "start", "period.start"))
    end = _to_date(_require(period, "end", "period.end"))
    if end < start:
        raise ConfigError("period.end が period.start より前になっています。")
    dates = [start + dt.timedelta(days=i) for i in range((end - start).days + 1)]

    shifts = []
    for i, s in enumerate(_require(data, "shifts", "勤務の種類（shifts）")):
        code = str(_require(s, "code", f"shifts[{i}].code"))
        shifts.append(
            ShiftType(
                code=code,
                name=str(s.get("name", code)),
                start=_norm_time(s.get("start", "09:00")),
                end=_norm_time(s.get("end", "18:00")),
            )
        )
    codes = [s.code for s in shifts]
    if len(set(codes)) != len(codes):
        raise ConfigError("shifts の code が重複しています。")
    for s in shifts:
        _parse_hhmm(s.start)
        _parse_hhmm(s.end)

    rules_data = data.get("rules", {}) or {}
    rules = Rules(
        forbidden_sequences=[
            (str(a), str(b)) for a, b in rules_data.get("forbidden_sequences", []) or []
        ],
        max_consecutive=rules_data.get("max_consecutive", 6),
        hope_off_is_hard=bool(rules_data.get("hope_off_is_hard", True)),
        time_limit_seconds=float(rules_data.get("time_limit_seconds", 10)),
    )
    for a, b in rules.forbidden_sequences:
        _check_code(a, codes, "rules.forbidden_sequences")
        _check_code(b, codes, "rules.forbidden_sequences")

    staff_list = []
    for i, p in enumerate(_require(data, "staff", "スタッフ（staff）")):
        name = str(_require(p, "name", f"staff[{i}].name"))
        allowed = [str(c) for c in p.get("shifts", codes)]
        for c in allowed:
            _check_code(c, codes, f"{name} の shifts")
        weekdays = (
            {_to_weekday(w) for w in p["weekdays"]} if p.get("weekdays") else set(range(7))
        )
        staff_list.append(
            Staff(
                name=name,
                shifts=allowed,
                weekdays=weekdays,
                min_days=p.get("min_days"),
                max_days=p.get("max_days"),
                max_consecutive=p.get("max_consecutive", rules.max_consecutive),
                max_hours_per_week=p.get("max_hours_per_week"),
                fair=bool(p.get("fair", True)),
            )
        )
    names = [p.name for p in staff_list]
    if len(set(names)) != len(names):
        raise ConfigError("staff の name が重複しています。同じ名前は使えません。")

    holidays = {_to_date(h) for h in data.get("holidays", []) or []}

    demand = _parse_demand(data.get("demand", {}) or {}, dates, codes, holidays)

    requests = []
    for i, r in enumerate(data.get("requests", []) or []):
        name = str(_require(r, "name", f"requests[{i}].name"))
        if name not in names:
            raise ConfigError(f"requests に staff にいない名前があります: {name}")
        d = _to_date(_require(r, "date", f"requests[{i}].date"))
        kind_raw = str(r.get("type", "休み"))
        if kind_raw in REQUEST_OFF:
            kind = "off"
        elif kind_raw in REQUEST_WANT:
            kind = "want"
        elif kind_raw in REQUEST_NG:
            kind = "ng"
        else:
            raise ConfigError(
                f"requests[{i}].type は「休み」「希望」「NG」のどれかにしてください: {kind_raw}"
            )
        shift = r.get("shift")
        if shift is not None:
            shift = str(shift)
            _check_code(shift, codes, f"requests[{i}].shift")
        if kind in ("want",) and shift is None:
            raise ConfigError(f"requests[{i}]: 「希望」には shift を指定してください。")
        requests.append(Request(name=name, date=d, kind=kind, shift=shift))

    w = data.get("weights", {}) or {}
    weights = Weights(**{k: int(v) for k, v in w.items() if k in Weights.__dataclass_fields__})

    return Problem(
        dates=dates,
        shifts=shifts,
        staff=staff_list,
        demand=demand,
        requests=requests,
        holidays=holidays,
        rules=rules,
        weights=weights,
    )


def _parse_demand(
    raw: dict[str, Any], dates: list[dt.date], codes: list[str], holidays: set[dt.date]
) -> dict[tuple[dt.date, str], int]:
    """必要人数を「全体 → 曜日 → 祝日 → 日付指定」の順に上書きして決める。"""
    default = raw.get("default", {}) or {}
    by_weekday = {_to_weekday(k): v for k, v in (raw.get("weekdays", {}) or {}).items()
                  if str(k) not in HOLIDAY_KEYS}
    by_holiday = next(
        (v for k, v in (raw.get("weekdays", {}) or {}).items() if str(k) in HOLIDAY_KEYS),
        raw.get("holiday"),
    )
    by_date = {_to_date(k): v for k, v in (raw.get("dates", {}) or {}).items()}

    result: dict[tuple[dt.date, str], int] = {}
    for d in dates:
        need = {c: 0 for c in codes}
        for layer in (
            default,
            by_weekday.get(d.weekday()),
            by_holiday if d in holidays else None,
            by_date.get(d),
        ):
            if layer:
                for c, n in layer.items():
                    _check_code(str(c), codes, "demand")
                    need[str(c)] = int(n)
        for c, n in need.items():
            result[(d, c)] = n
    return result


# ---------------------------------------------------------------- 小物


def _require(obj: Any, key: str, label: str) -> Any:
    if not isinstance(obj, dict) or key not in obj or obj[key] in (None, ""):
        raise ConfigError(f"{label} が設定されていません。")
    return obj[key]


def _check_code(code: str, codes: list[str], where: str) -> None:
    if code not in codes:
        raise ConfigError(f"{where} に shifts にない勤務コードがあります: {code}")


def _to_date(v: Any) -> dt.date:
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    try:
        return dt.date.fromisoformat(str(v).replace("/", "-"))
    except ValueError as e:
        raise ConfigError(f"日付の形式が正しくありません（例: 2026-12-01）: {v}") from e


def _to_weekday(v: Any) -> int:
    key = str(v).strip().lower()
    if key.endswith("曜日"):
        key = key[0]
    elif key.endswith("曜"):
        key = key[0]
    if key not in WEEKDAY_KEYS:
        raise ConfigError(f"曜日の書き方が正しくありません（例: 月, 土, sat）: {v}")
    return WEEKDAY_KEYS[key]


def _norm_time(v: Any) -> str:
    """YAML で 13:00 をクォートなしで書くと 780（分）になるので、文字列に戻す。"""
    if isinstance(v, int):
        return f"{v // 60:02d}:{v % 60:02d}"
    return str(v)


def _parse_hhmm(v: str) -> int:
    try:
        h, m = str(v).split(":")
        return int(h) * 60 + int(m)
    except ValueError as e:
        raise ConfigError(f"時刻の形式が正しくありません（例: 09:00）: {v}") from e
