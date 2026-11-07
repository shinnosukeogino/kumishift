import { datesOfMonth, weekdayOf } from "./dates";
import type { BusinessHours, SpecialDays } from "./schema";

export type CalendarDay = {
  date: string;
  weekday: number;
  holiday: string | null; // 祝日名
  closed: boolean;
  closedReason: string | null;
};

/** 月の日付に、祝日・定休日・臨時休業の情報を付ける */
export function monthCalendar(month: string, bh: BusinessHours, special: SpecialDays): CalendarDay[] {
  const holidays = new Map(special.holidays.map((h) => [h.date, h.name || "祝日"]));
  const closedDates = new Map(special.closedDates.map((c) => [c.date, c.name || "臨時休業"]));
  return datesOfMonth(month).map((date) => {
    const weekday = weekdayOf(date);
    const holiday = holidays.get(date) ?? null;
    let closedReason: string | null = null;
    if (closedDates.has(date)) closedReason = closedDates.get(date)!;
    else if (holiday && bh.holidayMode === "closed") closedReason = "祝日休業";
    else if (holiday && bh.holidayMode === "sunday" && bh.days[6].closed) closedReason = "祝日休業";
    else if (!(holiday && bh.holidayMode === "sunday") && bh.days[weekday].closed) closedReason = "定休日";
    return { date, weekday, holiday, closed: closedReason != null, closedReason };
  });
}
