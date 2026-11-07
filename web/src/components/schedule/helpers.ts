import type { ViewData } from "@/lib/types";

export const assigned = (d: ViewData, name: string, date: string) => d.assign[`${name}|${date}`];

export function countAt(d: ViewData, date: string, t: number) {
  let n = 0;
  for (const s of d.staff) {
    const c = assigned(d, s.name, date);
    if (!c) continue;
    const sh = d.shifts[c];
    if (sh && sh.start <= t && t < sh.end) n++;
  }
  return n;
}

export const shortLabel = (code: string) => code;
