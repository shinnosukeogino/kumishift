"""OR-Tools（CP-SAT）でシフトを組む。

守るルール（ハード制約）:
  - 1日に入る勤務は1人1つまで
  - 入れない勤務・出勤できない曜日には入れない
  - NG 指定の日・勤務には入れない
  - 希望休（rules.hope_off_is_hard が true のとき）
  - 期間内の最大出勤日数 / 最大連勤日数 / 週の最大勤務時間
  - 禁止する並び（例: 遅番の翌日に早番）
  - 固定（手で直した勤務・休み）。スタッフの条件や希望より優先する

できるだけ守るルール（ソフト制約。weights で重み付け）:
  - 必要人数を満たす（足りないと大きなペナルティ）
  - 必要人数より多く入れすぎない
  - 期間内の最低出勤日数
  - 希望した勤務に入れる
  - 出勤日数・土日祝の出勤日数をスタッフ間で平等にする
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from .model import Problem


@dataclass
class Shortage:
    date: dt.date
    shift: str
    need: int
    assigned: int


@dataclass
class StaffSummary:
    name: str
    days: int
    minutes: int
    weekend_days: int


@dataclass
class Result:
    status: str  # "最適" | "実行可能" | "解なし" | "時間切れ"
    assignments: dict[tuple[str, dt.date], str]
    shortages: list[Shortage] = field(default_factory=list)
    summaries: list[StaffSummary] = field(default_factory=list)
    unmet_requests: list[str] = field(default_factory=list)
    objective: float | None = None
    has_fixed: bool = False

    @property
    def ok(self) -> bool:
        return self.status in ("最適", "実行可能")


def solve(problem: Problem) -> Result:
    p = problem
    m = cp_model.CpModel()
    dates = p.dates
    codes = [s.code for s in p.shifts]
    w = p.weights

    ng = {(r.name, r.date, r.shift) for r in p.requests if r.kind == "ng" and r.time_from is None}
    off = {(r.name, r.date) for r in p.requests if r.kind == "off"}
    ng_time = [r for r in p.requests if r.kind == "ng" and r.time_from is not None]
    fixed = {(r.name, r.date): r.shift for r in p.requests if r.kind == "fixed"}
    fixed.update({(r.name, r.date): None for r in p.requests if r.kind == "fixed_off"})

    # x[name, date, code] = 1 ならその日その勤務に入る
    x: dict[tuple[str, dt.date, str], cp_model.IntVar] = {}
    for s in p.staff:
        for d in dates:
            if (s.name, d) in fixed:
                code = fixed[s.name, d]
                if code is not None:
                    x[s.name, d, code] = m.NewBoolVar(f"x_{s.name}_{d}_{code}")
                    m.Add(x[s.name, d, code] == 1)
                continue
            if d.weekday() not in s.weekdays:
                continue
            if p.rules.hope_off_is_hard and (s.name, d) in off:
                continue
            if (s.name, d, None) in ng:  # shift 指定なしの NG = その日は丸ごと不可
                continue
            for c in s.shifts:
                if (s.name, d, c) in ng:
                    continue
                if p.hourly and c not in p.day_codes.get(d, ()):
                    continue  # 定休日・営業時間外
                sh = p.shift_by_code(c)
                if any(
                    r.name == s.name and r.date == d and r.time_from < sh.end_min and sh.start_min < r.time_to
                    for r in ng_time
                ):
                    continue  # NG の時間帯にかかる
                x[s.name, d, c] = m.NewBoolVar(f"x_{s.name}_{d}_{c}")

    def shifts_of(name: str, d: dt.date) -> list[cp_model.IntVar]:
        return [x[name, d, c] for c in codes if (name, d, c) in x]

    # その日に出勤するか
    work: dict[tuple[str, dt.date], cp_model.LinearExpr] = {}
    for s in p.staff:
        for d in dates:
            vs = shifts_of(s.name, d)
            m.AddAtMostOne(vs)
            work[s.name, d] = sum(vs) if vs else 0

    penalties: list[cp_model.LinearExpr] = []

    # ---- 必要人数
    shortage_vars = {}
    x_by_date: dict[dt.date, list[tuple[int, int, cp_model.IntVar]]] = {}
    for (n, d, c), v in x.items():
        sh = p.shift_by_code(c)
        x_by_date.setdefault(d, []).append((sh.start_min, sh.end_min, v))
    for d in dates:
        if p.hourly:
            for t in p.slots_of(d):
                need = p.slot_demand.get((d, t), 0)
                covering = [v for a, b, v in x_by_date.get(d, []) if a <= t < b]
                short = m.NewIntVar(0, max(need, 0), f"short_{d}_{t}")
                over = m.NewIntVar(0, len(p.staff), f"over_{d}_{t}")
                m.Add(sum(covering) + short - over == need)
                shortage_vars[d, t] = short
                penalties.append(w.shortage * short + w.over * over)
            continue
        for c in codes:
            need = p.demand.get((d, c), 0)
            assigned = sum(x[s.name, d, c] for s in p.staff if (s.name, d, c) in x)
            short = m.NewIntVar(0, max(need, 0), f"short_{d}_{c}")
            over = m.NewIntVar(0, len(p.staff), f"over_{d}_{c}")
            m.Add(assigned + short - over == need)
            shortage_vars[d, c] = short
            penalties.append(w.shortage * short + w.over * over)

    # ---- スタッフごとのルール
    days_worked = {}
    weekend_worked = {}
    for s in p.staff:
        total = sum(work[s.name, d] for d in dates)
        dv = m.NewIntVar(0, len(dates), f"days_{s.name}")
        m.Add(dv == total)
        days_worked[s.name] = dv

        wk = m.NewIntVar(0, len(dates), f"weekend_{s.name}")
        m.Add(wk == sum(work[s.name, d] for d in dates if p.is_weekend(d)))
        weekend_worked[s.name] = wk

        if s.max_days is not None:
            m.Add(dv <= int(s.max_days))
        if s.min_days is not None:
            lack = m.NewIntVar(0, int(s.min_days), f"minlack_{s.name}")
            m.Add(dv + lack >= int(s.min_days))
            penalties.append(w.min_days * lack)

        # 連勤: どの (max+1) 日間を取っても出勤は max 日まで
        k = s.max_consecutive
        if k is not None and k < len(dates):
            k = int(k)
            for i in range(len(dates) - k):
                m.Add(sum(work[s.name, dates[i + j]] for j in range(k + 1)) <= k)

        # 週の勤務時間（月曜始まりで区切る）
        if s.max_hours_per_week is not None:
            limit = int(float(s.max_hours_per_week) * 60)
            for week in _weeks(dates):
                m.Add(
                    sum(
                        x[s.name, d, c] * p.work_minutes(c)
                        for d in week
                        for c in codes
                        if (s.name, d, c) in x
                    )
                    <= limit
                )

        # 禁止する並び（例: 遅番 → 翌日早番）
        for a, b in p.rules.forbidden_sequences:
            for d0, d1 in zip(dates, dates[1:]):
                if (s.name, d0, a) in x and (s.name, d1, b) in x:
                    m.AddBoolOr([x[s.name, d0, a].Not(), x[s.name, d1, b].Not()])

    # ---- 希望
    want_vars = []
    for r in p.requests:
        if r.kind == "want" and r.shift is None:
            # 勤務の指定なし = その日に出勤したい
            penalties.append(w.preference * (1 - work[r.name, r.date]))
        elif r.kind == "want":
            key = (r.name, r.date, r.shift)
            if key in x:
                want_vars.append((r, x[key]))
                penalties.append(w.preference * (1 - x[key]))
        elif r.kind == "off" and not p.rules.hope_off_is_hard:
            penalties.append(w.hope_off * work[r.name, r.date])

    # ---- 平等（fair: true のスタッフの間で、最多と最少の差を小さく）
    fair = [s.name for s in p.staff if s.fair]
    if len(fair) >= 2:
        for vars_, weight, label in (
            (days_worked, w.fairness, "days"),
            (weekend_worked, w.weekend_fairness, "weekend"),
        ):
            hi = m.NewIntVar(0, len(dates), f"hi_{label}")
            lo = m.NewIntVar(0, len(dates), f"lo_{label}")
            m.AddMaxEquality(hi, [vars_[n] for n in fair])
            m.AddMinEquality(lo, [vars_[n] for n in fair])
            penalties.append(weight * (hi - lo))

    if p.hourly and len(fair) >= 2:
        unit = p.slot_minutes
        total_units = {
            s.name: sum(
                x[s.name, d, c] * (p.work_minutes(c) // unit)
                for d in dates for c in codes if (s.name, d, c) in x
            )
            for s in p.staff if s.fair
        }
        ub = len(dates) * 24 * 60 // unit
        hi = m.NewIntVar(0, ub, "hi_hours")
        lo = m.NewIntVar(0, ub, "lo_hours")
        m.AddMaxEquality(hi, list(total_units.values()))
        m.AddMinEquality(lo, list(total_units.values()))
        penalties.append(w.hours_fairness * (hi - lo))

    m.Minimize(sum(penalties))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = p.rules.time_limit_seconds
    solver.parameters.num_workers = 8
    code = solver.Solve(m)

    status = {
        cp_model.OPTIMAL: "最適",
        cp_model.FEASIBLE: "実行可能",
        cp_model.INFEASIBLE: "解なし",
    }.get(code, "時間切れ")
    if status not in ("最適", "実行可能"):
        return Result(status=status, assignments={}, has_fixed=bool(fixed))

    assignments = {
        (n, d): c for (n, d, c), v in x.items() if solver.Value(v)
    }

    shortages = []
    for (d, c), v in shortage_vars.items():
        if solver.Value(v) > 0:
            if p.hourly:
                need = p.slot_demand[(d, c)]
                label = f"{c // 60:02d}:{c % 60:02d}-{(c + p.slot_minutes) // 60:02d}:{(c + p.slot_minutes) % 60:02d}"
                shortages.append(Shortage(d, label, need, need - solver.Value(v)))
            else:
                need = p.demand[(d, c)]
                shortages.append(Shortage(d, c, need, need - solver.Value(v)))

    summaries = []
    for s in p.staff:
        mine = [(d, c) for (n, d), c in assignments.items() if n == s.name]
        summaries.append(
            StaffSummary(
                name=s.name,
                days=len(mine),
                minutes=sum(p.work_minutes(c) for _, c in mine),
                weekend_days=sum(1 for d, _ in mine if p.is_weekend(d)),
            )
        )

    unmet = []
    for r in p.requests:
        got = assignments.get((r.name, r.date))
        if r.kind == "want" and r.shift is None and got is None:
            unmet.append(f"{r.name} {r.date:%m/%d} の出勤希望に入れられませんでした")
        elif r.kind == "want" and r.shift is not None and got != r.shift:
            unmet.append(f"{r.name} {r.date:%m/%d} {r.shift} の希望に入れられませんでした")
        if r.kind == "off" and got is not None:
            unmet.append(f"{r.name} {r.date:%m/%d} の希望休を守れませんでした")
    for s in p.staff:
        if s.min_days is not None:
            got = next(x.days for x in summaries if x.name == s.name)
            if got < s.min_days:
                unmet.append(f"{s.name} の最低出勤日数 {s.min_days} 日に届きません（{got} 日）")

    return Result(
        status=status,
        assignments=assignments,
        shortages=shortages,
        summaries=summaries,
        unmet_requests=unmet,
        objective=solver.ObjectiveValue(),
    )


def _weeks(dates: list[dt.date]) -> list[list[dt.date]]:
    weeks: list[list[dt.date]] = []
    for d in dates:
        if not weeks or d.weekday() == 0:
            weeks.append([])
        weeks[-1].append(d)
    return weeks
