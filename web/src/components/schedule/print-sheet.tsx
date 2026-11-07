"use client";

import { monthLabel, weekdayOf } from "@/lib/dates";
import { WEEKDAYS } from "@/lib/schema";
import { StaffAvatar } from "@/components/app/staff-avatar";
import { useBands, useStaffIcons } from "@/lib/bands";
import type { ViewData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { assigned } from "./helpers";

export type PrintKind = "calendar" | "month";

// 印刷では時間帯の色を薄く（soft）して、文字を濃くする（インクの節約と読みやすさのため）

const short = (m: number) => (m % 60 === 0 ? `${Math.floor(m / 60) % 24}` : `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, "0")}`);

/**
 * 印刷専用のシフト表（A4 横 1 枚）。画面には出さず、印刷するときだけ表示する。
 */
export function PrintSheet({
  kind,
  data,
  storeName,
  month,
  createdAt,
  mode = "print",
}: {
  /** print: 印刷するときだけ表示 / image: 画像にするために、画面の外にそのまま表示 */
  mode?: "print" | "image";
  kind: PrintKind;
  data: ViewData;
  storeName: string;
  month: string;
  createdAt: string;
}) {
  const shortages = data.shortages.length;
  const { bands, of } = useBands();
  return (
    <div className={cn("text-black", mode === "print" ? "hidden print:block" : "w-[297mm] bg-white p-[8mm]")}>
      {mode === "print" && <style>{`@page { size: A4 landscape; margin: 8mm; }`}</style>}
      <div className="flex h-[194mm] flex-col">
        <header className="mb-[2mm] flex items-end justify-between border-b border-black pb-[1.5mm]">
          <h1 className="text-[15pt] leading-none font-bold">
            {storeName}　{monthLabel(month)} シフト表
          </h1>
          <div className="flex items-center gap-[4mm] text-[7.5pt]">
            {bands.map((b) => (
              <span key={b.from} className="flex items-center gap-[1mm]">
                <i className={cn("inline-block h-[2.5mm] w-[4mm] rounded-[0.5mm] border", of(Number(b.from.slice(0, 2)) * 60 + Number(b.from.slice(3))).soft)} />
                {b.label}
              </span>
            ))}
            <span>
              作成 {new Date(createdAt).toLocaleDateString("ja-JP")}
              {shortages > 0 && `・人数不足 ${shortages}件`}
            </span>
          </div>
        </header>
        <div className="min-h-0 flex-1">
          {kind === "calendar" ? <PrintCalendar data={data} /> : <PrintMonth data={data} />}
        </div>
      </div>
    </div>
  );
}

function PrintCalendar({ data }: { data: ViewData }) {
  const { of } = useBands();
  const lead = weekdayOf(data.days[0].date);
  const cells: (number | null)[] = [...Array(lead).fill(null), ...data.days.map((_, i) => i)];
  while (cells.length % 7) cells.push(null);
  const weeks = cells.length / 7;

  const peopleOf = (date: string) =>
    data.staff
      .map((s) => ({ name: s.name, code: assigned(data, s.name, date) }))
      .filter((p): p is { name: string; code: string } => !!p.code)
      .sort((a, b) => data.shifts[a.code].start - data.shifts[b.code].start);
  const maxPeople = Math.max(1, ...data.days.map((d) => peopleOf(d.date).length));
  // 1日の人数が多い月は2列にして、文字を小さくする
  const twoCols = maxPeople * (weeks === 6 ? 1.2 : 1) > 9;
  const font = twoCols ? (maxPeople > 18 ? "text-[6pt]" : "text-[6.5pt]") : maxPeople > 7 ? "text-[7pt]" : "text-[8pt]";

  return (
    <div className="grid h-full grid-cols-7 border-t border-l border-black" style={{ gridTemplateRows: `5mm repeat(${weeks}, 1fr)` }}>
      {WEEKDAYS.map((w, i) => (
        <div
          key={w}
          className={cn(
            "grid place-items-center border-r border-b border-black bg-neutral-100 text-[8pt] font-bold",
            i === 5 && "text-blue-700",
            i === 6 && "text-red-700",
          )}
        >
          {w}
        </div>
      ))}
      {cells.map((idx, k) => {
        if (idx == null) return <div key={`e${k}`} className="border-r border-b border-black bg-neutral-50" />;
        const d = data.days[idx];
        const people = peopleOf(d.date);
        return (
          <div key={d.date} className={cn("overflow-hidden border-r border-b border-black px-[1mm] py-[0.5mm]", d.closed && "bg-neutral-100")}>
            <div className="flex items-baseline gap-[1mm] leading-tight">
              <span className={cn("text-[9pt] font-bold", d.wd === "土" && "text-blue-700", (d.wd === "日" || d.wd === "祝") && "text-red-700")}>
                {d.label.split("/")[1]}
              </span>
              {d.wd === "祝" && <span className="text-[6.5pt] text-red-700">祝</span>}
              {d.closed && <span className="text-[7pt] text-neutral-500">休業</span>}
              {!d.closed && <span className="ml-auto text-[6.5pt] text-neutral-500">{people.length}人</span>}
            </div>
            <ul className={cn("leading-[1.3]", font, twoCols && "grid grid-cols-2 gap-x-[1mm]")}>
              {people.map((p) => {
                const sh = data.shifts[p.code];
                return (
                  <li key={p.name} className="flex items-center gap-[0.8mm] whitespace-nowrap">
                    <i className={cn("inline-block h-[2mm] w-[1.2mm] shrink-0 rounded-[0.3mm] border", of(sh.start).soft)} />
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="ml-auto tabular-nums">
                      {short(sh.start)}-{short(sh.end)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function PrintMonth({ data }: { data: ViewData }) {
  const { of } = useBands();
  const iconOf = useStaffIcons();
  const rows = data.staff.length;
  // 用紙の高さに合わせて行の高さを決める（少ない人数なら広く、多いと狭く）
  const rowStyle = { height: `min(15mm, calc(165mm / ${rows + 1}))` };
  const big = rows <= 12;
  return (
    <table className={cn("w-full table-fixed border-collapse", big ? "text-[8pt]" : "text-[7pt]")}>
      <colgroup>
        <col className="w-[17mm]" />
        {data.days.map((d) => (
          <col key={d.date} />
        ))}
        <col className="w-[15mm]" />
      </colgroup>
      <thead>
        <tr>
          <th className="border border-black bg-neutral-100 px-[1mm] text-left">名前</th>
          {data.days.map((d) => (
            <th key={d.date} className={cn("border border-black py-[0.5mm] leading-tight font-bold", d.weekend ? "bg-neutral-200" : "bg-neutral-100")}>
              <div>{d.label.split("/")[1]}</div>
              <div className={cn("text-[6.5pt]", d.wd === "土" && "text-blue-700", (d.wd === "日" || d.wd === "祝") && "text-red-700")}>{d.wd}</div>
            </th>
          ))}
          <th className="border border-black bg-neutral-100 text-[6.5pt]">日数/時間</th>
        </tr>
      </thead>
      <tbody>
        {data.staff.map((s) => (
          <tr key={s.name} style={rowStyle}>
            <th className="truncate border border-black px-[1mm] text-left text-[8pt]">
              <span className="flex items-center gap-[1mm]">
                <StaffAvatar name={s.name} icon={iconOf(s.name)} className="size-[4.5mm] border border-neutral-300 bg-white text-[6pt] text-black" />
                {s.name}
              </span>
            </th>
            {data.days.map((d) => {
              const c = assigned(data, s.name, d.date);
              const sh = c ? data.shifts[c] : null;
              return (
                <td key={d.date} className={cn("border border-black p-[0.3mm] text-center", d.closed && "bg-neutral-100 text-neutral-400", d.weekend && !d.closed && "bg-neutral-50")}>
                  {sh ? (
                    <div className={cn("rounded-[0.5mm] border py-[0.2mm] leading-[1.15] font-semibold tabular-nums", of(sh.start).soft)}>
                      <div>{short(sh.start)}</div>
                      <div>{short(sh.end)}</div>
                    </div>
                  ) : d.closed ? (
                    "休"
                  ) : null}
                </td>
              );
            })}
            <td className="border border-black text-center text-[6.5pt] leading-tight tabular-nums">
              {s.days}日
              <br />
              {+s.hours.toFixed(1)}h
            </td>
          </tr>
        ))}
        <tr>
          <th className="border border-black px-[1mm] text-left text-[6.5pt] font-normal">出勤人数</th>
          {data.days.map((d) => (
            <td key={d.date} className="border border-black text-center text-[6.5pt] tabular-nums">
              {d.closed ? "" : data.staff.filter((s) => assigned(data, s.name, d.date)).length}
            </td>
          ))}
          <td className="border border-black" />
        </tr>
      </tbody>
    </table>
  );
}

