"""結果を CSV / JSON / 画面表示に書き出す。"""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

from .model import WEEKDAY_LABELS, Problem
from .solver import Result


def _date_label(p: Problem, d) -> str:
    mark = "祝" if d in p.holidays else WEEKDAY_LABELS[d.weekday()]
    closed = p.hourly and not p.business_hours.get(d)
    return f"{d.month}/{d.day}({mark})" + ("休" if closed else "")


def to_rows(p: Problem, r: Result) -> list[list[str]]:
    """シフト表を「行 = スタッフ、列 = 日付」の2次元リストにする。"""
    header = ["名前"] + [_date_label(p, d) for d in p.dates] + ["出勤日数", "勤務時間", "土日祝"]
    rows = [header]
    summary = {s.name: s for s in r.summaries}
    for s in p.staff:
        line = [s.name]
        for d in p.dates:
            line.append(r.assignments.get((s.name, d), ""))
        sm = summary[s.name]
        line += [str(sm.days), f"{sm.minutes / 60:g}", str(sm.weekend_days)]
        rows.append(line)

    rows.append([])
    if p.hourly:
        all_slots = sorted({t for d in p.dates for t in p.slots_of(d)})
        for t in all_slots:
            line = [f"{_hm(t)}-{_hm(t + p.slot_minutes)}（人数/必要）"]
            for d in p.dates:
                if t not in p.slots_of(d):
                    line.append("")
                    continue
                n = _count_at(p, r, d, t)
                need = p.slot_demand.get((d, t), 0)
                line.append(f"{n}/{need}" + (" 不足" if n < need else ""))
            rows.append(line)
        return rows
    for sh in p.shifts:
        line = [f"{sh.name}（人数/必要）"]
        for d in p.dates:
            n = sum(1 for st in p.staff if r.assignments.get((st.name, d)) == sh.code)
            need = p.demand.get((d, sh.code), 0)
            line.append(f"{n}/{need}" + (" 不足" if n < need else ""))
        rows.append(line)
    return rows


def _hm(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def _count_at(p: Problem, r: Result, d, t: int) -> int:
    n = 0
    for st in p.staff:
        c = r.assignments.get((st.name, d))
        if c:
            sh = p.shift_by_code(c)
            if sh.start_min <= t < sh.end_min:
                n += 1
    return n


def write_csv(p: Problem, r: Result, path: str | Path) -> None:
    # Excel で文字化けしないように BOM 付き UTF-8 で書く
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        csv.writer(f).writerows(to_rows(p, r))


def to_dict(p: Problem, r: Result) -> dict:
    return {
        "status": r.status,
        "period": {"start": p.dates[0].isoformat(), "end": p.dates[-1].isoformat()},
        "assignments": [
            {"name": n, "date": d.isoformat(), "shift": c}
            for (n, d), c in sorted(r.assignments.items(), key=lambda kv: (kv[0][1], kv[0][0]))
        ],
        "shortages": [
            {"date": s.date.isoformat(), "shift": s.shift, "need": s.need, "assigned": s.assigned}
            for s in r.shortages
        ],
        "staff": [
            {
                "name": s.name,
                "days": s.days,
                "hours": s.minutes / 60,
                "weekend_days": s.weekend_days,
            }
            for s in r.summaries
        ],
        "warnings": r.unmet_requests,
    }


def write_json(p: Problem, r: Result, path: str | Path) -> None:
    Path(path).write_text(json.dumps(to_dict(p, r), ensure_ascii=False, indent=2), encoding="utf-8")


def format_text(p: Problem, r: Result) -> str:
    """ターミナル表示用。日付が多いと横に長いので、7日ずつ折り返す。"""
    out = io.StringIO()
    out.write(f"結果: {r.status}\n")
    if not r.ok:
        return out.getvalue()
    width = max(_width(s.name) for s in p.staff) + 2
    for i in range(0, len(p.dates), 7):
        chunk = p.dates[i : i + 7]
        out.write("\n" + _pad("", width) + "".join(_pad(_date_label(p, d), 10) for d in chunk) + "\n")
        for s in p.staff:
            cells = "".join(_pad(r.assignments.get((s.name, d), "-"), 10) for d in chunk)
            out.write(_pad(s.name, width) + cells + "\n")

    out.write("\n出勤日数 / 勤務時間 / 土日祝\n")
    for s in r.summaries:
        out.write(f"  {s.name}: {s.days}日 / {s.minutes / 60:g}時間 / {s.weekend_days}日\n")

    if r.shortages:
        out.write("\n⚠ 人数が足りない枠\n")
        for s in r.shortages:
            out.write(f"  {_date_label(p, s.date)} {s.shift}: {s.assigned}/{s.need} 人\n")
    if r.unmet_requests:
        out.write("\n⚠ 守れなかった希望\n")
        for msg in r.unmet_requests:
            out.write(f"  {msg}\n")
    if not r.shortages and not r.unmet_requests:
        out.write("\n✓ すべての枠が埋まり、希望もすべて守れました\n")
    return out.getvalue()


def _width(text: str) -> int:
    """全角を幅2として数える。"""
    import unicodedata

    return sum(2 if unicodedata.east_asian_width(ch) in "WF" else 1 for ch in text)


def _pad(text: str, width: int) -> str:
    return text + " " * max(width - _width(text), 1)
