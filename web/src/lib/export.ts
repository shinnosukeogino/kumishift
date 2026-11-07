import { hm, weekdayLabel } from "./dates";
import type { ViewData } from "./types";

const key = (name: string, date: string) => `${name}|${date}`;

type Shift = { name: string; date: string; start: number; end: number; break: number };

/** 書き出し用に、勤務を1件ずつ並べる（日付 → 開始時刻 → スタッフの並び順） */
export function listShifts(data: ViewData, names?: string[]): Shift[] {
  const target = names ?? data.staff.map((s) => s.name);
  const out: Shift[] = [];
  for (const d of data.days) {
    for (const name of target) {
      const c = data.assign[key(name, d.date)];
      if (!c) continue;
      const sh = data.shifts[c];
      out.push({ name, date: d.date, start: sh.start, end: sh.end, break: sh.break ?? 0 });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

// ---------------------------------------------------------------- ics（カレンダー）

/** "2027-01-04" と 分 → "20270104T100000"（日またぎは翌日にする） */
function icsTime(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + Math.floor(minutes / 1440) * 86400000);
  const mm = minutes % 1440;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}T${p(Math.floor(mm / 60))}${p(mm % 60)}00`;
}

const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** 1行75バイトまでのきまり（RFC 5545）に合わせて折り返す */
function fold(line: string) {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

/**
 * カレンダー用ファイル（.ics）を作る。Google カレンダー・iPhone・Outlook に取り込める。
 * UID はスタッフID と日付で決まるので、作り直したあとに取り込み直すと同じ予定が上書きされる。
 */
export function buildIcs({
  data,
  storeName,
  names,
  idOf,
  personal,
}: {
  data: ViewData;
  storeName: string;
  /** 書き出すスタッフ（省略で全員） */
  names?: string[];
  /** 名前 → スタッフID */
  idOf: (name: string) => string;
  /** 1人分のとき true（予定の名前に自分の名前を入れない） */
  personal: boolean;
}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"); // 例: 20261108T041500Z
  const calName = personal && names?.length === 1 ? `${storeName} シフト（${names[0]}）` : `${storeName} シフト`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//kumishift//shift//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calName)}`,
    "X-WR-TIMEZONE:Asia/Tokyo",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Tokyo",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:JST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  for (const s of listShifts(data, names)) {
    const time = `${hm(s.start)}〜${hm(s.end)}`;
    const summary = personal ? `シフト ${time}` : `${s.name} ${time}`;
    const work = (s.end - s.start - s.break) / 60;
    const desc = [`${storeName}`, `${s.name} さん ${time}`, s.break ? `休憩 ${s.break}分・実働 ${work}時間` : `実働 ${work}時間`, "kumishift で作成"].join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${idOf(s.name)}-${s.date}@kumishift`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Tokyo:${icsTime(s.date, s.start)}`,
      `DTEND;TZID=Asia/Tokyo:${icsTime(s.date, s.end)}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(desc)}`,
      `LOCATION:${escapeText(storeName)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- CSV（Excel）

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number)[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

/** 月間表の形（行 = スタッフ、列 = 日付） */
export function buildMonthCsv(data: ViewData) {
  const header = ["名前", ...data.days.map((d) => `${d.label}(${d.wd})`), "出勤日数", "勤務時間（実働）", "土日祝"];
  const rows: (string | number)[][] = [header];
  for (const s of data.staff) {
    rows.push([
      s.name,
      ...data.days.map((d) => {
        const c = data.assign[key(s.name, d.date)];
        if (!c) return d.closed ? "休業" : "";
        const sh = data.shifts[c];
        return `${hm(sh.start)}-${hm(sh.end)}`;
      }),
      s.days,
      +s.hours.toFixed(2),
      s.weekend,
    ]);
  }
  rows.push(["出勤人数", ...data.days.map((d) => (d.closed ? "" : data.staff.filter((s) => data.assign[key(s.name, d.date)]).length)), "", "", ""]);
  return csv(rows);
}

/** 1行1勤務の一覧（給与計算・集計向け） */
export function buildListCsv(data: ViewData) {
  const rows: (string | number)[][] = [["日付", "曜日", "名前", "開始", "終了", "勤務時間", "休憩（分）", "実働時間"]];
  for (const s of listShifts(data)) {
    rows.push([
      s.date,
      weekdayLabel(s.date),
      s.name,
      hm(s.start),
      hm(s.end),
      +((s.end - s.start) / 60).toFixed(2),
      s.break,
      +((s.end - s.start - s.break) / 60).toFixed(2),
    ]);
  }
  return csv(rows);
}

// ---------------------------------------------------------------- 保存

/** 文字列をファイルとして保存する。CSV は Excel で文字化けしないよう BOM を付ける */
export function downloadText(text: string, fileName: string, type: string, bom = false) {
  const blob = new Blob([bom ? "\uFEFF" : "", text], { type });
  downloadBlob(blob, fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ファイル名に使えない文字を消す */
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 30) || "shift";
