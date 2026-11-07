"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hm } from "@/lib/dates";
import { StaffAvatar } from "@/components/app/staff-avatar";
import { useBands, useStaffIcons } from "@/lib/bands";
import type { ViewData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { assigned, countAt } from "./helpers";

export function DayView({
  data,
  index,
  edited,
  onIndex,
  onEdit,
}: {
  data: ViewData;
  index: number;
  edited: Set<string>;
  onIndex: (i: number) => void;
  onEdit: (name: string, date: string) => void;
}) {
  const day = data.days[index];
  const shortDates = new Set(data.shortages.map((s) => s.date));
  // 表示する範囲: 営業時間（手で営業時間の外に入れた勤務があれば広げる）
  const todays = data.staff.map((s) => assigned(data, s.name, day.date)).filter(Boolean).map((c) => data.shifts[c!]);
  const lo = Math.floor(Math.min(day.open ?? 9 * 60, ...todays.map((s) => s.start)) / 60) * 60;
  const hi = Math.ceil(Math.max(day.close ?? 22 * 60, ...todays.map((s) => s.end)) / 60) * 60;
  const breaks = day.breaks ?? [];
  const { of } = useBands();
  const iconOf = useStaffIcons();
  const pct = (m: number) => `${((m - lo) / (hi - lo)) * 100}%`;
  const hours = Array.from({ length: (hi - lo) / 60 + 1 }, (_, k) => lo + k * 60);
  const working = data.staff.filter((s) => assigned(data, s.name, day.date));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {data.days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            onClick={() => onIndex(i)}
            className={cn(
              "focus-visible:ring-ring/50 min-w-14 rounded-md border px-2 py-1 text-xs tabular-nums outline-none focus-visible:ring-[3px]",
              i === index ? "border-primary bg-accent text-accent-foreground font-bold" : "hover:bg-muted",
              d.closed && "text-muted-foreground",
              shortDates.has(d.date) && i !== index && "border-destructive/60 text-destructive",
            )}
          >
            {d.label}({d.wd})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="icon-sm" aria-label="前の日" disabled={index === 0} onClick={() => onIndex(index - 1)}>
          <ChevronLeft />
        </Button>
        <h3 className="text-lg font-bold">
          {day.label}（{day.wd}）
        </h3>
        <Button variant="outline" size="icon-sm" aria-label="次の日" disabled={index === data.days.length - 1} onClick={() => onIndex(index + 1)}>
          <ChevronRight />
        </Button>
        <span className="text-muted-foreground text-sm">
          {day.closed
            ? "定休日"
            : day.open != null && day.close != null
              ? `営業 ${hm(day.open)}〜${hm(day.close)}${breaks.map(([f, t]) => `（中休み ${hm(f)}〜${hm(t)}）`).join("")}・${working.length}人出勤`
              : ""}
        </span>
        <span className="text-muted-foreground ml-auto text-xs">名前の行を押すと、その人の勤務を直せます</span>
      </div>

      {day.closed && todays.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center">この日はお休みです</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="text-muted-foreground grid grid-cols-[6rem_1fr_4.5rem] text-[11px]">
              <div />
              <div className="relative h-5">
                {hours.map((t, k) => (
                  <span
                    key={t}
                    className={cn("absolute whitespace-nowrap", k === 0 ? "" : k === hours.length - 1 ? "-translate-x-full" : "-translate-x-1/2")}
                    style={{ left: pct(t) }}
                  >
                    {Math.floor(t / 60) % 24}時
                  </span>
                ))}
              </div>
              <div />
            </div>
            {data.staff.map((s) => {
              const c = assigned(data, s.name, day.date);
              const sh = c ? data.shifts[c] : null;
              const isEdited = edited.has(`${s.name}|${day.date}`);
              return (
                <button
                  type="button"
                  key={s.name}
                  onClick={() => onEdit(s.name, day.date)}
                  aria-label={`${s.name} ${sh ? `${hm(sh.start)}〜${hm(sh.end)}` : "休み"}（押すと直せます）`}
                  className="hover:bg-muted/60 focus-visible:ring-ring/50 grid min-h-10 w-full grid-cols-[6rem_1fr_4.5rem] items-center border-b text-left outline-none focus-visible:ring-[3px]"
                >
                  <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    <StaffAvatar name={s.name} icon={iconOf(s.name)} className="size-5 text-[10px]" />
                    {s.name}
                  </div>
                  <div className="relative h-10">
                    {hours.map((t) => (
                      <div key={t} className="bg-border absolute top-0 bottom-0 w-px" style={{ left: pct(t) }} />
                    ))}
                    {breaks.map(([f, t]) => (
                      <div
                        key={f}
                        className="absolute top-0 bottom-0 bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_4px,transparent_4px,transparent_8px)]"
                        style={{ left: pct(f), width: `calc(${pct(t)} - ${pct(f)})` }}
                      />
                    ))}
                    {sh && (
                      <div
                        className={cn(
                          "absolute top-2 flex h-6 items-center overflow-hidden rounded-md px-2 text-xs font-semibold whitespace-nowrap shadow-sm",
                          of(sh.start).solid,
                          isEdited && "ring-foreground ring-2 ring-offset-1",
                        )}
                        style={{ left: pct(sh.start), width: `calc(${pct(sh.end)} - ${pct(sh.start)})` }}
                      >
                        {hm(sh.start)}〜{hm(sh.end)}
                        {sh.break ? <span className="ml-1.5 font-normal opacity-90">休憩{sh.break}分</span> : null}
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground text-right text-xs">
                    {sh ? `${(sh.end - sh.start - (sh.break ?? 0)) / 60}時間` : isEdited ? "休み（直した）" : "休み"}
                  </div>
                </button>
              );
            })}
            <div className="grid grid-cols-[6rem_1fr_4.5rem] items-center pt-2">
              <div className="text-sm font-semibold">人数/必要</div>
              <div className="relative h-10">
                {day.slots.map((sl) => {
                  const n = countAt(data, day.date, sl.t);
                  return (
                    <div
                      key={sl.t}
                      title={`${hm(sl.t)}〜${hm(sl.t + data.step)}`}
                      className={cn(
                        "absolute top-1 grid h-8 place-items-center rounded text-[11px] font-bold tabular-nums",
                        n < sl.need ? "bg-warn-bg text-destructive" : n > sl.need ? "bg-accent text-accent-foreground" : "bg-ok-bg text-ok",
                      )}
                      style={{ left: `calc(${pct(sl.t)} + 1px)`, width: `calc(${pct(sl.t + data.step)} - ${pct(sl.t)} - 2px)` }}
                    >
                      {n}/{sl.need}
                    </div>
                  );
                })}
              </div>
              <div />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
