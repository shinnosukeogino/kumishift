import { breakRange, toMinutes, WEEKDAYS, type BusinessHours, type Demand } from "./schema";

/** 設定画面のプレビュー用に、ある曜日の時間ごとの必要人数を計算する（エンジンと同じ上書き順） */
export function previewDemand(bh: BusinessHours, demand: Demand, weekday: number, holiday = false) {
  let day = bh.days[weekday];
  if (holiday && bh.holidayMode === "sunday") day = bh.days[6];
  if (holiday && bh.holidayMode === "closed") return null;
  if (!day || day.closed) return null;
  const open = toMinutes(day.open);
  let close = toMinutes(day.close);
  if (close <= open) close += 1440;
  const step = bh.stepMinutes;

  const closed = day.breakFrom && day.breakTo ? breakRange(day.open, day.breakFrom, day.breakTo) : null;
  const need = new Map<number, number>();
  for (let t = open; t < close; t += step) {
    if (closed && closed[0] <= t && t < closed[1]) continue; // 中休み
    need.set(t, demand.defaultCount);
  }

  const group = weekday < 5 ? "平日" : "土日祝";
  const layers = [
    demand.rows.filter((r) => r.days === "毎日"),
    demand.rows.filter((r) => r.days === group || r.days === WEEKDAYS[weekday]),
    holiday ? demand.rows.filter((r) => r.days === "土日祝" || r.days === "祝") : [],
  ];
  for (const rows of layers) {
    for (const r of rows) {
      const f = toMinutes(r.from);
      let to = toMinutes(r.to);
      if (to <= f) to += 1440;
      for (const t of need.keys()) if (f <= t && t < to) need.set(t, r.count);
    }
  }
  return { open, close, step, slots: [...need.entries()].map(([t, n]) => ({ t, need: n })) };
}
