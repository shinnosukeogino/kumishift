/** 勤務の開始時刻で色を決める（朝・昼・夕方・夜） */
export function shiftTone(startMinutes: number): "am" | "mid" | "pm" | "night" {
  if (startMinutes >= 22 * 60 || startMinutes < 5 * 60) return "night";
  if (startMinutes < 11 * 60) return "am";
  if (startMinutes < 15 * 60) return "mid";
  return "pm";
}

export const TONE_CLASS = {
  am: "bg-shift-am text-white",
  mid: "bg-shift-mid text-white",
  pm: "bg-shift-pm text-white",
  night: "bg-shift-night text-white",
} as const;

export const TONE_LABEL = {
  am: "朝（〜11時開始）",
  mid: "昼（11〜15時開始）",
  pm: "夕方（15時〜開始）",
  night: "夜（22時〜開始）",
} as const;
