"use client";

import { PALETTE } from "./palette";
import { toMinutes, type TimeBand } from "./schema";
import { useAppStore } from "./store";

export type BandStyle = { label: string; solid: string; soft: string; dot: string };

/** 勤務の始まる時刻から時間帯を決める。最初の時間帯より早い時刻は、最後の時間帯（夜）とみなす */
export function bandOf(bands: TimeBand[], startMinutes: number): BandStyle {
  const sorted = [...bands].sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
  const t = startMinutes % 1440;
  let hit = sorted[sorted.length - 1];
  for (const b of sorted) if (toMinutes(b.from) <= t) hit = b;
  const p = PALETTE[hit.color] ?? PALETTE.slate;
  return { label: hit.label, solid: p.solid, soft: p.soft, dot: p.dot };
}

/** 画面で使う: 時間帯の一覧と、勤務の開始時刻 → 色 */
export function useBands() {
  const bands = useAppStore((s) => s.display.bands);
  const sorted = [...bands].sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
  return {
    bands: sorted,
    of: (startMinutes: number) => bandOf(sorted, startMinutes),
  };
}

/** スタッフ名 → アイコン */
export function useStaffIcons() {
  const staff = useAppStore((s) => s.staff);
  const map = new Map(staff.map((s) => [s.name, s.icon]));
  return (name: string) => map.get(name) ?? "";
}
