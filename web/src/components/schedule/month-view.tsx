"use client";

import { cn } from "@/lib/utils";
import { shiftTone, TONE_CLASS, TONE_LABEL } from "@/lib/shift-color";
import type { ViewData } from "@/lib/types";

import { assigned } from "./helpers";

export function MonthView({
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
  const shortByDate = new Map<string, number>();
  for (const s of data.shortages) shortByDate.set(s.date, (shortByDate.get(s.date) ?? 0) + 1);

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
        {(["am", "mid", "pm"] as const).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <i className={cn("inline-block size-2.5 rounded-sm", TONE_CLASS[t])} />
            {TONE_LABEL[t]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <i className="ring-foreground inline-block size-2.5 rounded-sm ring-2 ring-offset-1" />
          手で直した勤務
        </span>
        <span>マスを押すと直せます。日付を押すと、その日の時間帯が見られます</span>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="bg-card sticky left-0 z-20 min-w-24 border-b px-3 py-2 text-left">名前</th>
              {data.days.map((d, i) => (
                <th
                  key={d.date}
                  className={cn("border-b p-0 font-semibold", d.weekend && "bg-muted/60", d.closed && "text-muted-foreground")}
                >
                  <button
                    type="button"
                    onClick={() => onPickDay(i)}
                    className="hover:text-primary focus-visible:ring-ring/50 w-full min-w-12 px-0.5 py-2 outline-none focus-visible:ring-[3px]"
                  >
                    <div className="tabular-nums">{d.label.split("/")[1]}</div>
                    <div className={cn(d.wd === "土" && "text-blue-600", (d.wd === "日" || d.wd === "祝") && "text-red-600")}>{d.wd}</div>
                  </button>
                </th>
              ))}
              <th className="bg-card sticky right-0 z-20 border-b border-l px-3 py-2 whitespace-nowrap">日数・時間</th>
            </tr>
          </thead>
          <tbody>
            {data.staff.map((s) => (
              <tr key={s.name}>
                <th className="bg-card sticky left-0 z-10 border-b px-3 py-1.5 text-left text-sm whitespace-nowrap">{s.name}</th>
                {data.days.map((d) => {
                  const c = assigned(data, s.name, d.date);
                  const sh = c ? data.shifts[c] : null;
                  return (
                    <td
                      key={d.date}
                      className={cn(
                        "border-b p-0.5 text-center",
                        d.weekend && "bg-muted/30",
                        d.closed && "bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_4px,transparent_4px,transparent_8px)]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onEdit(s.name, d.date)}
                        aria-label={`${s.name} ${d.label} ${c ?? "休み"}（押すと直せます）`}
                        className="hover:bg-accent focus-visible:ring-ring/50 grid min-h-8 w-full place-items-center rounded outline-none focus-visible:ring-[3px]"
                      >
                        {sh ? (
                          <span
                            className={cn(
                              "inline-block min-w-11 rounded px-1 py-1 text-[11px] font-semibold tabular-nums",
                              TONE_CLASS[shiftTone(sh.start)],
                              edited.has(`${s.name}|${d.date}`) && "ring-foreground ring-2 ring-offset-1",
                            )}
                          >
                            {c}
                          </span>
                        ) : d.closed ? (
                          <span className="text-muted-foreground">休</span>
                        ) : edited.has(`${s.name}|${d.date}`) ? (
                          <span className="text-muted-foreground rounded border border-dashed px-1.5 text-[11px]">休み</span>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
                <td className="bg-card text-muted-foreground sticky right-0 border-b border-l px-3 text-center whitespace-nowrap tabular-nums">
                  {s.days}日・{+s.hours.toFixed(1)}h
                </td>
              </tr>
            ))}
            <tr>
              <th className="bg-card text-muted-foreground sticky left-0 z-10 px-3 py-2 text-left font-normal">充足</th>
              {data.days.map((d) => {
                const n = shortByDate.get(d.date) ?? 0;
                return (
                  <td key={d.date} className={cn("px-0.5 py-2 text-center", n ? "bg-warn-bg text-destructive font-bold" : "text-ok")}>
                    {d.closed ? "" : n ? `不足${n}` : "✓"}
                  </td>
                );
              })}
              <td className="bg-card sticky right-0 border-l" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
