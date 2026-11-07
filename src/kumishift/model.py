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
REQUEST_FIXED = {"固定", "fixed"}
REQUEST_FIXED_OFF = {"固定休み", "fixed_off"}


class ConfigError(ValueError):
    """設定ファイルの内容に問題があるときのエラー。"""


@dataclass
class ShiftType:
    code: str
    name: str
    start: str
    end: str

    @property
    def start_min(self) -> int:
        return _parse_hhmm(self.start)

    @property
    def end_min(self) -> int:
        e = _parse_hhmm(self.end)
        return e + 24 * 60 if e <= self.start_min else e

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
    available_from: int | None = None  # 分（時間帯モード）
    available_to: int | None = None
    min_hours_per_day: float | None = None
    max_hours_per_day: float | None = None


@dataclass
class Request:
    name: str
    date: dt.date
    kind: str  # "off" | "want" | "ng" | "fixed" | "fixed_off"
    shift: str | None = None
    time_from: int | None = None  # NG の時間指定（時間帯モード）
    time_to: int | None = None


@dataclass
class Rules:
    forbidden_sequences: list[tuple[str, str]] = field(default_factory=list)
    max_consecutive: int | None = 6
    hope_off_is_hard: bool = True
    time_limit_seconds: float = 10.0
    # 休憩: (この分数を超える勤務なら, 休憩の分数)。例: [(360, 45), (480, 60)]
    breaks: list[tuple[int, int]] = field(default_factory=list)


@dataclass
class Weights:
    shortage: int = 1000
    over: int = 10
    min_days: int = 100
    hope_off: int = 200
    preference: int = 5
    fairness: int = 20
    weekend_fairness: int = 10
    hours_fairness: int = 5  # 時間帯モード: 合計勤務時間の偏り


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
    # ---- 時間帯モード（hourly を書いたときだけ使う）
    hourly: bool = False
    slot_minutes: int = 60
    business_hours: dict[dt.date, tuple[int, int] | None] = field(default_factory=dict)
    slot_demand: dict[tuple[dt.date, int], int] = field(default_factory=dict)  # (日付, 開始分) -> 人数
    day_codes: dict[dt.date, set[str]] = field(default_factory=dict)  # その日に使える勤務
    closed_ranges: dict[dt.date, list[tuple[int, int]]] = field(default_factory=dict)  # 中休み

    def slots_of(self, d: dt.date) -> list[int]:
        """その日の時間枠の開始時刻（分）。定休日と中休みの時間は含まない。"""
        bh = self.business_hours.get(d)
        if not bh:
            return []
        closed = self.closed_ranges.get(d, [])
        return [
            t for t in range(bh[0], bh[1], self.slot_minutes)
            if not any(f <= t < e for f, e in closed)
        ]

    def break_minutes(self, code: str) -> int:
        """その勤務の休憩時間（分）。勤務時間の長さで決まる。"""
        span = self.shift_by_code(code).minutes
        return max((b for over, b in self.rules.breaks if span > over), default=0)

    def work_minutes(self, code: str) -> int:
        """休憩を引いた実働時間（分）。"""
        return self.shift_by_code(code).minutes - self.break_minutes(code)

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

    holidays = {_to_date(h) for h in data.get("holidays", []) or []}

    hourly = data.get("hourly")
    if hourly:
        shifts, hourly_info = _parse_hourly(hourly, dates, holidays)
    else:
        shifts, hourly_info = _parse_shifts(data), None
    codes = [s.code for s in shifts]

    rules_data = data.get("rules", {}) or {}
    rules = Rules(
        forbidden_sequences=[
            (str(a), str(b)) for a, b in rules_data.get("forbidden_sequences", []) or []
        ],
        max_consecutive=rules_data.get("max_consecutive", 6),
        hope_off_is_hard=bool(rules_data.get("hope_off_is_hard", True)),
        time_limit_seconds=float(rules_data.get("time_limit_seconds", 10)),
        breaks=_parse_breaks(rules_data.get("breaks")),
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
        av_from = _parse_hhmm(_norm_time(p["available_from"])) if p.get("available_from") else None
        av_to = _parse_hhmm(_norm_time(p["available_to"])) if p.get("available_to") else None
        min_h = p.get("min_hours_per_day")
        max_h = p.get("max_hours_per_day")
        if hourly_info:
            # 時間帯モード: 入れる時間・1日の勤務時間に合う勤務だけ残す
            by_code = {sh.code: sh for sh in shifts}
            allowed = [
                c for c in allowed
                if (av_from is None or by_code[c].start_min >= av_from)
                and (av_to is None or by_code[c].end_min <= av_to)
                and (min_h is None or by_code[c].minutes >= float(min_h) * 60)
                and (max_h is None or by_code[c].minutes <= float(max_h) * 60)
            ]
            if not allowed:
                raise ConfigError(f"{name} が入れる時間の組み合わせがありません。入れる時間と1日の勤務時間を確認してください。")
        staff_list.append(
            Staff(
                name=name,
                shifts=allowed,
                available_from=av_from,
                available_to=av_to,
                min_hours_per_day=min_h,
                max_hours_per_day=max_h,
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

    if hourly_info:
        demand = {(d, c): 0 for d in dates for c in codes}
    else:
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
        elif kind_raw in REQUEST_FIXED:
            kind = "fixed"
        elif kind_raw in REQUEST_FIXED_OFF:
            kind = "fixed_off"
        else:
            raise ConfigError(
                f"requests[{i}].type は「休み」「希望」「NG」「固定」「固定休み」のどれかにしてください: {kind_raw}"
            )
        shift = r.get("shift")
        if shift is not None:
            shift = str(shift)
            _check_code(shift, codes, f"requests[{i}].shift")
        t_from = _parse_hhmm(_norm_time(r["from"])) if r.get("from") is not None else None
        t_to = _parse_hhmm(_norm_time(r["to"])) if r.get("to") is not None else None
        if (t_from is None) != (t_to is None):
            raise ConfigError(f"requests[{i}]: from と to は両方指定してください。")
        if t_from is not None and t_to is not None and t_to <= t_from:
            t_to += 24 * 60  # 日またぎ
        if kind == "fixed" and shift is None and t_from is None:
            raise ConfigError(f"requests[{i}]: 「固定」には shift か from/to を指定してください。")
        requests.append(
            Request(name=name, date=d, kind=kind, shift=shift, time_from=t_from, time_to=t_to)
        )

    _resolve_fixed(requests, shifts, staff_list, hourly_info)

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
        **(hourly_info or {}),
    )


def _resolve_fixed(
    requests: list[Request],
    shifts: list[ShiftType],
    staff_list: list[Staff],
    hourly_info: dict[str, Any] | None,
) -> None:
    """「固定」（手で直した勤務）を勤務コードにそろえる。

    時間帯モードで、自動で作る勤務パターンにない時間（例: 10:30-14:00）が指定されたら、
    その時間の勤務を追加する。固定はスタッフの条件より優先する。
    """
    by_time = {(s.start_min, s.end_min): s.code for s in shifts}
    staff_by_name = {s.name: s for s in staff_list}
    seen: set[tuple[str, dt.date]] = set()
    for r in requests:
        if r.kind not in ("fixed", "fixed_off"):
            continue
        if (r.name, r.date) in seen:
            raise ConfigError(f"{r.name} の {r.date} に「固定」が2つあります。")
        seen.add((r.name, r.date))
        if r.kind == "fixed_off":
            continue
        if r.shift is None:
            key = (r.time_from, r.time_to)
            code = by_time.get(key)
            if code is None:
                if not hourly_info:
                    raise ConfigError(
                        f"{r.name} の {r.date} の固定: 指定した時間に合う勤務がありません。shift で勤務を指定してください。"
                    )
                code = f"{_fmt(r.time_from)}-{_fmt(r.time_to)}"
                shifts.append(
                    ShiftType(code=code, name=code, start=_hhmm(r.time_from), end=_hhmm(r.time_to))
                )
                by_time[key] = code
            r.shift = code
        if hourly_info:
            hourly_info["day_codes"].setdefault(r.date, set()).add(r.shift)
        st = staff_by_name[r.name]
        if r.shift not in st.shifts:
            st.shifts.append(r.shift)


def _parse_breaks(raw: Any) -> list[tuple[int, int]]:
    """rules.breaks: [{over_hours: 6, minutes: 45}, ...]"""
    out = []
    for i, b in enumerate(raw or []):
        if not isinstance(b, dict):
            raise ConfigError("rules.breaks は {over_hours, minutes} のリストにしてください。")
        over = float(_require(b, "over_hours", f"rules.breaks[{i}].over_hours"))
        minutes = int(_require(b, "minutes", f"rules.breaks[{i}].minutes"))
        if over <= 0 or minutes < 0:
            raise ConfigError(f"rules.breaks[{i}] の値が正しくありません。")
        out.append((int(over * 60), minutes))
    return out


def _parse_shifts(data: dict[str, Any]) -> list[ShiftType]:
    shifts = []
    for i, s in enumerate(_require(data, "shifts", "勤務の種類（shifts）。時間単位で組むときは hourly")):
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
    return shifts


CLOSED = {"定休日", "休業", "休み", "closed"}


def _parse_hourly(
    h: dict[str, Any], dates: list[dt.date], holidays: set[dt.date]
) -> tuple[list[ShiftType], dict[str, Any]]:
    """時間帯モード: 営業時間と時間ごとの必要人数から、勤務パターンを自動で作る。"""
    step = int(h.get("step_minutes", 60))
    if step <= 0 or (24 * 60) % step:
        raise ConfigError("hourly.step_minutes は 15, 30, 60 などにしてください。")
    min_len = int(float(h.get("min_hours", 3)) * 60)
    max_len = int(float(h.get("max_hours", 8)) * 60)
    if min_len > max_len:
        raise ConfigError("hourly.min_hours が max_hours より大きくなっています。")
    start_step = int(h.get("start_step_minutes", step))

    # ---- 営業時間: default → 曜日 → 祝日 → 日付指定
    bh_raw = _require(h, "business_hours", "営業時間（hourly.business_hours）")
    if "open" in bh_raw:  # business_hours: {open, close} だけの省略形
        bh_raw = {"default": bh_raw}
    wd_raw = bh_raw.get("weekdays", {}) or {}
    by_wd = {_to_weekday(k): v for k, v in wd_raw.items() if str(k) not in HOLIDAY_KEYS}
    by_hol = next((v for k, v in wd_raw.items() if str(k) in HOLIDAY_KEYS), bh_raw.get("holiday"))
    by_date = {_to_date(k): v for k, v in (bh_raw.get("dates", {}) or {}).items()}

    closed_ranges: dict[dt.date, list[tuple[int, int]]] = {}

    def breaks_of(v: Any, where: str, o: int, c: int) -> list[tuple[int, int]]:
        out = []
        for j, b in enumerate((v.get("breaks") if isinstance(v, dict) else None) or []):
            f = _parse_hhmm(_norm_time(_require(b, "from", f"{where}.breaks[{j}].from")))
            t = _parse_hhmm(_norm_time(_require(b, "to", f"{where}.breaks[{j}].to")))
            if f < o:
                f += 24 * 60
            if t <= f:
                t += 24 * 60
            if not (o < f < t < c):
                raise ConfigError(f"{where} の中休み（{_hhmm(f)}〜{_hhmm(t)}）が営業時間の中に入っていません。")
            if (f % step) or (t % step):
                raise ConfigError(f"{where} の中休みが step_minutes（{step}分）の区切りに合っていません。")
            out.append((f, t))
        return out

    def hours(v: Any, where: str) -> tuple[int, int] | None:
        if v is False or (isinstance(v, str) and v in CLOSED):
            return None
        o = _parse_hhmm(_norm_time(_require(v, "open", f"{where}.open")))
        c = _parse_hhmm(_norm_time(_require(v, "close", f"{where}.close")))
        if c <= o:
            c += 24 * 60  # 深夜営業（例: 18:00〜02:00）
        if (o % step) or (c % step):
            raise ConfigError(f"{where} の営業時間が step_minutes（{step}分）の区切りに合っていません。")
        return (o, c)

    business: dict[dt.date, tuple[int, int] | None] = {}
    default_bh = bh_raw.get("default")
    for d in dates:
        v, where = default_bh, "business_hours.default"
        if d.weekday() in by_wd:
            v, where = by_wd[d.weekday()], f"business_hours.weekdays.{WEEKDAY_LABELS[d.weekday()]}"
        if d in holidays and by_hol is not None:
            v, where = by_hol, "business_hours.weekdays.祝"
        if d in by_date:
            v, where = by_date[d], f"business_hours.dates.{d}"
        if v is None:
            raise ConfigError("business_hours.default（ふだんの営業時間）を設定してください。")
        business[d] = hours(v, where)
        if business[d]:
            closed_ranges[d] = breaks_of(v, where, *business[d])

    # ---- 勤務パターン（開始時刻 × 長さ）を作る
    spans = {bh for bh in business.values() if bh}
    if not spans:
        raise ConfigError("期間中に営業日がありません。")
    lo = min(o for o, _ in spans)
    hi = max(c for _, c in spans)
    shifts: list[ShiftType] = []
    for start in range(lo, hi, start_step):
        for length in range(min_len, max_len + 1, step):
            end = start + length
            if end > hi:
                break
            code = f"{_fmt(start)}-{_fmt(end)}"
            shifts.append(ShiftType(code=code, name=code, start=_hhmm(start), end=_hhmm(end)))
    if not shifts:
        raise ConfigError("営業時間が min_hours より短いため、勤務パターンが作れません。")

    def fits(s: ShiftType, d: dt.date, bh: tuple[int, int] | None) -> bool:
        if not bh or s.start_min < bh[0] or s.end_min > bh[1]:
            return False
        # 中休みにかかる勤務は作らない（中休みの前か後のどちらかに入る）
        return not any(s.start_min < t and f < s.end_min for f, t in closed_ranges.get(d, []))

    day_codes = {d: {s.code for s in shifts if fits(s, d, bh)} for d, bh in business.items()}

    # ---- 時間ごとの必要人数: default → 曜日 → 祝日 → 日付指定（指定した時間だけ上書き）
    dm = h.get("demand", {}) or {}
    if isinstance(dm, list):
        dm = {"default": dm}
    dwd = dm.get("weekdays", {}) or {}
    d_by_wd = {_to_weekday(k): v for k, v in dwd.items() if str(k) not in HOLIDAY_KEYS}
    d_by_hol = next((v for k, v in dwd.items() if str(k) in HOLIDAY_KEYS), dm.get("holiday"))
    d_by_date = {_to_date(k): v for k, v in (dm.get("dates", {}) or {}).items()}
    default_count = int(h.get("default_count", 1))

    slot_demand: dict[tuple[dt.date, int], int] = {}
    for d in dates:
        bh = business[d]
        if not bh:
            continue
        need = {
            t: default_count
            for t in range(bh[0], bh[1], step)
            if not any(f <= t < e for f, e in closed_ranges.get(d, []))
        }
        for layer in (
            dm.get("default"),
            d_by_wd.get(d.weekday()),
            d_by_hol if d in holidays else None,
            d_by_date.get(d),
        ):
            for j, item in enumerate(layer or []):
                f = _parse_hhmm(_norm_time(_require(item, "from", f"hourly.demand[{j}].from")))
                t = _parse_hhmm(_norm_time(_require(item, "to", f"hourly.demand[{j}].to")))
                if t <= f:
                    t += 24 * 60
                n = int(item.get("count", 1))
                for slot in need:
                    if f <= slot < t:
                        need[slot] = n
        for slot, n in need.items():
            slot_demand[d, slot] = n

    return shifts, {
        "hourly": True,
        "slot_minutes": step,
        "business_hours": business,
        "slot_demand": slot_demand,
        "day_codes": day_codes,
        "closed_ranges": closed_ranges,
    }


def _fmt(m: int) -> str:
    """勤務コード用の短い時刻表記（10:00 → 10、10:30 → 10:30）。"""
    h, mm = divmod(m, 60)
    return f"{h}" if mm == 0 else f"{h}:{mm:02d}"


def _hhmm(m: int) -> str:
    h, mm = divmod(m, 60)
    return f"{h:02d}:{mm:02d}"


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
