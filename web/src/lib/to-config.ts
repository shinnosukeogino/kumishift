import { datesOfMonth } from "./dates";
import { WEEKDAYS, type BusinessHours, type Demand, type ShiftRequest, type SpecialDays, type Staff, type WorkRules } from "./schema";

type Input = {
  month: string;
  businessHours: BusinessHours;
  workRules: WorkRules;
  demand: Demand;
  specialDays: SpecialDays;
  staff: Staff[];
  requests: ShiftRequest[];
};

/** 画面のデータを、エンジン（POST /api/solve）の設定 JSON に変換する */
export function toEngineConfig(v: Input) {
  const dates = datesOfMonth(v.month);
  const inMonth = (d: string) => d.startsWith(v.month);

  // ---- 営業時間
  const hoursOf = (i: number) => {
    const d = v.businessHours.days[i];
    return d.closed ? "定休日" : { open: d.open, close: d.close };
  };
  const firstOpen = v.businessHours.days.findIndex((d) => !d.closed);
  const weekdayHours: Record<string, unknown> = {};
  WEEKDAYS.forEach((w, i) => (weekdayHours[w] = hoursOf(i)));
  if (v.businessHours.holidayMode === "sunday") weekdayHours["祝"] = hoursOf(6);
  if (v.businessHours.holidayMode === "closed") weekdayHours["祝"] = "定休日";

  const closedDates: Record<string, string> = {};
  for (const c of v.specialDays.closedDates) if (inMonth(c.date)) closedDates[c.date] = "定休日";

  // ---- 必要人数（毎日 → 平日/土日祝/曜日 → 祝 の順に上書き）
  const row = (r: Demand["rows"][number]) => ({ from: r.from, to: r.to, count: r.count });
  const daily = v.demand.rows.filter((r) => r.days === "毎日").map(row);
  const byWeekday: Record<string, ReturnType<typeof row>[]> = {};
  WEEKDAYS.forEach((w, i) => {
    const group = i < 5 ? "平日" : "土日祝";
    byWeekday[w] = [
      ...v.demand.rows.filter((r) => r.days === group).map(row),
      ...v.demand.rows.filter((r) => r.days === w).map(row),
    ];
  });
  const holidayRows = [
    ...v.demand.rows.filter((r) => r.days === "土日祝").map(row),
    ...v.demand.rows.filter((r) => r.days === "祝").map(row),
  ];
  if (holidayRows.length) byWeekday["祝"] = holidayRows;

  // ---- スタッフ
  const names = new Map(v.staff.map((s) => [s.id, s.name]));
  const staff = v.staff.map((s) => {
    const o: Record<string, unknown> = {
      name: s.name,
      weekdays: s.weekdays.map((i) => WEEKDAYS[i]),
      fair: s.fair,
    };
    if (s.availableFrom) o.available_from = s.availableFrom;
    if (s.availableTo) o.available_to = s.availableTo;
    if (s.minHoursPerDay != null) o.min_hours_per_day = s.minHoursPerDay;
    if (s.maxHoursPerDay != null) o.max_hours_per_day = s.maxHoursPerDay;
    if (s.minDays != null) o.min_days = s.minDays;
    if (s.maxDays != null) o.max_days = s.maxDays;
    if (s.maxHoursPerWeek != null) o.max_hours_per_week = s.maxHoursPerWeek;
    if (s.maxConsecutive != null) o.max_consecutive = s.maxConsecutive;
    return o;
  });

  // ---- 希望
  const requests = v.requests
    .filter((r) => inMonth(r.date) && names.has(r.staffId))
    .map((r) => {
      const name = names.get(r.staffId)!;
      if (r.type === "off") return { name, date: r.date, type: "休み" };
      if (r.type === "want") return { name, date: r.date, type: "希望" };
      if (r.type === "ng") return { name, date: r.date, type: "NG" };
      return { name, date: r.date, type: "NG", from: r.from, to: r.to };
    });

  return {
    period: { start: dates[0], end: dates[dates.length - 1] },
    holidays: v.specialDays.holidays.filter((h) => inMonth(h.date)).map((h) => h.date),
    hourly: {
      step_minutes: v.businessHours.stepMinutes,
      min_hours: v.workRules.minHours,
      max_hours: v.workRules.maxHours,
      business_hours: {
        default: hoursOf(firstOpen < 0 ? 0 : firstOpen),
        weekdays: weekdayHours,
        dates: closedDates,
      },
      default_count: v.demand.defaultCount,
      demand: { default: daily, weekdays: byWeekday },
    },
    staff,
    requests,
    rules: {
      max_consecutive: v.workRules.maxConsecutive,
      hope_off_is_hard: v.workRules.hopeOffHard,
      time_limit_seconds: v.workRules.timeLimitSeconds,
    },
  };
}
