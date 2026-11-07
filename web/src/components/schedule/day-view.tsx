"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hm } from "@/lib/dates";
import { shiftTone, TONE_CLASS } from "@/lib/shift-color";
import type { ViewData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { assigned, countAt } from "./helpers";

export function DayView({ data, index, onIndex }: { data: ViewData; index: number; onIndex: (i: number) => void }) {
  const day = data.days[index];
  const shortDates = new Set(data.shortages.map((s) => s.date));
  const lo = day.open != null ? Math.floor(day.open / 60) * 60 : 9 * 60;
  const hi = day.close != null ? Math.ceil(day.close / 60) * 60 : 22 * 60;
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
          {day.closed ? "定休日" : day.open != null && day.close != null ? `営業 ${hm(day.open)}〜${hm(day.close)}・${working.length}人出勤` : ""}
        </span>
      </div>

      {day.closed ? (
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
              return (
                <div key={s.name} className="grid min-h-10 grid-cols-[6rem_1fr_4.5rem] items-center border-b">
                  <div className="truncate text-sm font-semibold">{s.name}</div>
                  <div className="relative h-10">
                    {hours.map((t) => (
                      <div key={t} className="bg-border absolute top-0 bottom-0 w-px" style={{ left: pct(t) }} />
                    ))}
                    {sh && (
                      <div
                        className={cn("absolute top-2 flex h-6 items-center overflow-hidden rounded-md px-2 text-xs font-semibold whitespace-nowrap shadow-sm", TONE_CLASS[shiftTone(sh.start)])}
                        style={{ left: pct(sh.start), width: `calc(${pct(sh.end)} - ${pct(sh.start)})` }}
                      >
                        {hm(sh.start)}〜{hm(sh.end)}
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground text-right text-xs">{sh ? `${(sh.end - sh.start) / 60}時間` : "休み"}</div>
                </div>
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
