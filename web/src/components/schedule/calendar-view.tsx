"use client";

import { weekdayOf } from "@/lib/dates";
import { WEEKDAYS } from "@/lib/schema";
import { StaffAvatar } from "@/components/app/staff-avatar";
import { useBands, useStaffIcons } from "@/lib/bands";
import type { ViewData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { assigned } from "./helpers";

const MAX_LINES = 7;

/** 月間カレンダー（週ごと）。日ごとに出勤する人と時間を表示する */
export function CalendarView({
  data,
  edited,
  onPickDay,
  onEdit,
}: {
  data: ViewData;
  edited: Set<string>;
  onPickDay: (i: number) => void;
  onEdit: (name: string, date: string) => void;
}) {
  const { of } = useBands();
  const iconOf = useStaffIcons();
  const shortByDate = new Map<string, number>();
  for (const s of data.shortages) shortByDate.set(s.date, (shortByDate.get(s.date) ?? 0) + 1);

  // 月曜始まりの週に並べる（月初の前は空きマス）
  const lead = weekdayOf(data.days[0].date);
  const cells: (number | null)[] = [...Array(lead).fill(null), ...data.days.map((_, i) => i)];
  while (cells.length % 7) cells.push(null);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[840px] grid-cols-7 overflow-hidden rounded-lg border">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={cn(
              "bg-muted/60 border-b py-2 text-center text-xs font-semibold",
              i === 5 && "text-blue-600",
              i === 6 && "text-red-600",
            )}
          >
            {w}
          </div>
        ))}
        {cells.map((idx, k) => {
          if (idx == null) return <div key={`e${k}`} className="bg-muted/20 min-h-32 border-r border-b last:border-r-0" />;
          const d = data.days[idx];
          const people = data.staff
            .map((s) => ({ name: s.name, code: assigned(data, s.name, d.date) }))
            .filter((p): p is { name: string; code: string } => !!p.code)
            .sort((a, b) => data.shifts[a.code].start - data.shifts[b.code].start);
          const shorts = shortByDate.get(d.date) ?? 0;
          return (
            <div
              key={d.date}
              className={cn(
                "flex min-h-32 flex-col gap-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
                d.weekend && "bg-muted/30",
                d.closed && "bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_4px,transparent_4px,transparent_8px)]",
              )}
            >
              <button
                type="button"
                onClick={() => onPickDay(idx)}
                className="hover:bg-accent focus-visible:ring-ring/50 flex items-center gap-1.5 rounded px-1 text-left outline-none focus-visible:ring-[3px]"
                aria-label={`${d.label}の日別表示`}
              >
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    d.wd === "土" && "text-blue-600",
                    (d.wd === "日" || d.wd === "祝") && "text-red-600",
                  )}
                >
                  {d.label.split("/")[1]}
                </span>
                {d.wd === "祝" && <span className="text-[10px] text-red-600">祝</span>}
                {d.closed && <span className="text-muted-foreground text-[10px]">休業</span>}
                {!d.closed && (
                  <span className={cn("ml-auto text-[10px]", shorts ? "text-destructive font-bold" : "text-muted-foreground")}>
                    {shorts ? `不足${shorts}` : `${people.length}人`}
                  </span>
                )}
              </button>
              <ul className="space-y-0.5">
                {people.slice(0, MAX_LINES).map((p) => {
                  const sh = data.shifts[p.code];
                  return (
                    <li key={p.name}>
                      <button
                        type="button"
                        onClick={() => onEdit(p.name, d.date)}
                        className={cn(
                          "hover:bg-accent focus-visible:ring-ring/50 flex w-full items-center gap-1 rounded px-1 text-left text-[11px] leading-5 outline-none focus-visible:ring-[3px]",
                          edited.has(`${p.name}|${d.date}`) && "ring-foreground/70 ring-1",
                        )}
                        aria-label={`${p.name} ${p.code}（押すと直せます）`}
                      >
                        <StaffAvatar name={p.name} icon={iconOf(p.name)} className="size-4 text-[9px]" />
                        <span className="truncate font-medium">{p.name}</span>
                        <span className={cn("ml-auto rounded px-1 leading-4 tabular-nums", of(sh.start).solid)}>{p.code}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {people.length > MAX_LINES && (
                <button type="button" onClick={() => onPickDay(idx)} className="text-muted-foreground hover:text-foreground px-1 text-left text-[11px]">
                  ほか{people.length - MAX_LINES}人
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
