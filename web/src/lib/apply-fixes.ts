import { hm } from "./dates";
import { toMinutes, type ShiftFix, type Staff } from "./schema";
import type { ViewData } from "./types";

const fmt = (m: number) => (m % 60 === 0 ? `${m / 60}` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`);

export const key = (name: string, date: string) => `${name}|${date}`;

/** 勤務の長さから休憩（分）を決める */
export function breakFor(span: number, rules: { overMinutes: number; minutes: number }[] = []) {
  return Math.max(0, ...rules.filter((r) => span > r.overMinutes).map((r) => r.minutes));
}

/**
 * 作成したシフトに、手で直した内容を重ねる。
 * 出勤日数・時間・人数不足も計算し直すので、作り直さなくても表示は正しくなる。
 */
export function applyFixes(data: ViewData, fixes: ShiftFix[], staff: Staff[]) {
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const dates = new Set(data.days.map((d) => d.date));
  const assign = { ...data.assign };
  const shifts = { ...data.shifts };
  const edited = new Set<string>();

  for (const f of fixes) {
    const name = nameById.get(f.staffId);
    if (!name || !dates.has(f.date)) continue;
    const k = key(name, f.date);
    edited.add(k);
    if (f.off) {
      delete assign[k];
      continue;
    }
    const start = toMinutes(f.from);
    let end = toMinutes(f.to);
    if (end <= start) end += 1440;
    let code = Object.keys(shifts).find((c) => shifts[c].start === start && shifts[c].end === end);
    if (!code) {
      code = `${fmt(start)}-${fmt(end)}`;
      shifts[code] = { name: code, start, end, break: breakFor(end - start, data.breakRules) };
    }
    assign[k] = code;
  }

  if (edited.size === 0) return { data, edited };

  const weekend = new Map(data.days.map((d) => [d.date, d.weekend]));
  const staffStats = data.staff.map((s) => {
    let days = 0;
    let minutes = 0;
    let we = 0;
    for (const d of data.days) {
      const c = assign[key(s.name, d.date)];
      if (!c) continue;
      const sh = shifts[c];
      days++;
      minutes += sh.end - sh.start - (sh.break ?? 0);
      if (weekend.get(d.date)) we++;
    }
    return { ...s, days, hours: minutes / 60, weekend: we };
  });

  const count = (date: string, pred: (code: string) => boolean) =>
    data.staff.filter((s) => {
      const c = assign[key(s.name, date)];
      return c ? pred(c) : false;
    }).length;

  const shortages: ViewData["shortages"] = [];
  for (const d of data.days) {
    if (d.closed) continue;
    if (data.hourly) {
      for (const sl of d.slots) {
        const n = count(d.date, (c) => shifts[c].start <= sl.t && sl.t < shifts[c].end);
        if (n < sl.need) {
          shortages.push({ date: d.date, shift: `${hm(sl.t)}-${hm(sl.t + data.step)}`, need: sl.need, assigned: n });
        }
      }
    } else {
      for (const [c, need] of Object.entries(d.need)) {
        const n = count(d.date, (x) => x === c);
        if (n < need) shortages.push({ date: d.date, shift: c, need, assigned: n });
      }
    }
  }

  return { data: { ...data, assign, shifts, staff: staffStats, shortages }, edited };
}
