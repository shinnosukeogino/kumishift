import { z } from "zod";

/** 曜日（月曜 = 0 … 日曜 = 6。エンジンと同じ並び） */
export const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"] as const;

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時刻は 09:00 の形で入力してください");

const optionalTime = z.union([time, z.literal("")]);

/** 空欄 = 制限なし。数値入力（NumberInput）は空欄を null にする */
const optionalInt = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label}は数字で入力してください` })
    .int(`${label}は整数で入力してください`)
    .min(min, `${label}は${min}以上にしてください`)
    .max(max, `${label}は${max}以下にしてください`)
    .nullable();

const optionalNum = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label}は数字で入力してください` })
    .min(min, `${label}は${min}以上にしてください`)
    .max(max, `${label}は${max}以下にしてください`)
    .nullable();

export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// ---------------------------------------------------------------- 営業時間

/** 開店〜閉店を分に直す（閉店が開店より早ければ日またぎ） */
export function openRange(open: string, close: string): [number, number] {
  const o = toMinutes(open);
  let c = toMinutes(close);
  if (c <= o) c += 1440;
  return [o, c];
}

/** 中休みを分に直す（営業時間に合わせて日またぎを補正） */
export function breakRange(open: string, from: string, to: string): [number, number] {
  const o = toMinutes(open);
  let f = toMinutes(from);
  if (f < o) f += 1440;
  let t = toMinutes(to);
  if (t <= f) t += 1440;
  return [f, t];
}

export const businessDaySchema = z
  .object({
    closed: z.boolean(),
    open: time,
    close: time,
    /** 中休み（お店を閉める時間）。空欄 = なし */
    breakFrom: optionalTime,
    breakTo: optionalTime,
  })
  .superRefine((d, ctx) => {
    if (d.closed) return;
    if (d.open === d.close) {
      ctx.addIssue({ code: "custom", message: "開店と閉店が同じ時刻です", path: ["close"] });
      return;
    }
    if (!d.breakFrom && !d.breakTo) return;
    if (!d.breakFrom || !d.breakTo) {
      ctx.addIssue({ code: "custom", message: "中休みの始まりと終わりを両方選んでください", path: ["breakTo"] });
      return;
    }
    const [o, c] = openRange(d.open, d.close);
    const [f, t] = breakRange(d.open, d.breakFrom, d.breakTo);
    if (!(o < f && t < c)) {
      ctx.addIssue({ code: "custom", message: "中休みは営業時間の中にしてください", path: ["breakTo"] });
    }
  });

export const businessHoursSchema = z
  .object({
    days: z.array(businessDaySchema).length(7),
    /** 祝日の営業時間: 日曜と同じ / ふだんの曜日どおり / 休業 */
    holidayMode: z.enum(["sunday", "weekday", "closed"]),
    stepMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  })
  .superRefine((v, ctx) => {
    if (v.days.every((d) => d.closed)) {
      ctx.addIssue({ code: "custom", message: "営業日が1日もありません", path: ["days"] });
    }
    v.days.forEach((d, i) => {
      if (d.closed) return;
      for (const [key, t] of [
        ["open", d.open],
        ["close", d.close],
        ["breakFrom", d.breakFrom],
        ["breakTo", d.breakTo],
      ] as const) {
        if (!t) continue;
        if (toMinutes(t) % v.stepMinutes !== 0) {
          ctx.addIssue({
            code: "custom",
            message: `${v.stepMinutes}分単位で入力してください`,
            path: ["days", i, key],
          });
        }
      }
    });
  });

export type BusinessHours = z.infer<typeof businessHoursSchema>;

// ---------------------------------------------------------------- 勤務のルール

export const breakRuleSchema = z.object({
  overHours: z.number({ error: "数字で入力してください" }).min(1, "1時間以上にしてください").max(16),
  minutes: z.number({ error: "数字で入力してください" }).int("整数で入力してください").min(0).max(180, "180分以下にしてください"),
});

export type BreakRule = z.infer<typeof breakRuleSchema>;

export const workRulesSchema = z
  .object({
    minHours: z.number({ error: "数字で入力してください" }).min(1, "1時間以上にしてください").max(16),
    maxHours: z.number({ error: "数字で入力してください" }).min(1).max(16, "16時間以下にしてください"),
    maxConsecutive: z.number({ error: "数字で入力してください" }).int().min(1, "1日以上にしてください").max(31),
    hopeOffHard: z.boolean(),
    timeLimitSeconds: z.number({ error: "数字で入力してください" }).min(1, "1秒以上にしてください").max(30, "30秒以下にしてください"),
    /** 休憩: 勤務が overHours 時間を超えたら minutes 分。勤務時間（実働）から差し引く */
    breakRules: z.array(breakRuleSchema).max(5),
  })
  .refine((v) => v.minHours <= v.maxHours, {
    message: "最短が最長より長くなっています",
    path: ["minHours"],
  });

export type WorkRules = z.infer<typeof workRulesSchema>;

// ---------------------------------------------------------------- 必要人数

export const DEMAND_DAYS = ["毎日", "平日", "土日祝", ...WEEKDAYS, "祝"] as const;
export type DemandDays = (typeof DEMAND_DAYS)[number];

export const demandRowSchema = z
  .object({
    days: z.enum(DEMAND_DAYS),
    from: time,
    to: time,
    count: z.number({ error: "数字で入力してください" }).int("整数で入力してください").min(0, "0人以上にしてください").max(50),
  })
  .refine((r) => r.from !== r.to, { message: "開始と終了が同じです", path: ["to"] });

export const demandSchema = z.object({
  defaultCount: z.number({ error: "数字で入力してください" }).int().min(0, "0人以上にしてください").max(50),
  rows: z.array(demandRowSchema),
});

export type Demand = z.infer<typeof demandSchema>;
export type DemandRow = z.infer<typeof demandRowSchema>;

// ---------------------------------------------------------------- 祝日・休業日

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を選んでください");

export const specialDaysSchema = z.object({
  holidays: z.array(z.object({ date: isoDate, name: z.string().max(30) })),
  closedDates: z.array(z.object({ date: isoDate, name: z.string().max(30) })),
});

export type SpecialDays = z.infer<typeof specialDaysSchema>;

// ---------------------------------------------------------------- スタッフ

export const staffSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1, "名前を入力してください").max(20, "20文字以内にしてください"),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1, "出勤できる曜日を1つ以上選んでください"),
    availableFrom: optionalTime,
    availableTo: optionalTime,
    minHoursPerDay: optionalNum(1, 16, "1日の最短"),
    maxHoursPerDay: optionalNum(1, 16, "1日の最長"),
    minDays: optionalInt(0, 31, "最低出勤日数"),
    maxDays: optionalInt(0, 31, "最大出勤日数"),
    maxHoursPerWeek: optionalNum(1, 80, "週の上限"),
    maxConsecutive: optionalInt(1, 31, "最大連勤"),
    fair: z.boolean(),
    memo: z.string().max(100, "100文字以内にしてください"),
  })
  .superRefine((s, ctx) => {
    if (s.availableFrom && s.availableTo && s.availableFrom >= s.availableTo) {
      ctx.addIssue({ code: "custom", message: "終わりを始まりより後にしてください", path: ["availableTo"] });
    }
    if (s.minHoursPerDay != null && s.maxHoursPerDay != null && s.minHoursPerDay > s.maxHoursPerDay) {
      ctx.addIssue({ code: "custom", message: "最短が最長より長くなっています", path: ["minHoursPerDay"] });
    }
    if (s.minDays != null && s.maxDays != null && s.minDays > s.maxDays) {
      ctx.addIssue({ code: "custom", message: "最低が最大より多くなっています", path: ["minDays"] });
    }
  });

export type Staff = z.infer<typeof staffSchema>;

// ---------------------------------------------------------------- 希望（シフト入力）

export const REQUEST_TYPES = {
  off: { label: "休み希望", short: "休" },
  want: { label: "出勤希望", short: "出" },
  ng: { label: "NG（終日）", short: "NG" },
  ngTime: { label: "時間NG", short: "時" },
} as const;

export type RequestType = keyof typeof REQUEST_TYPES;

export const shiftRequestSchema = z
  .object({
    staffId: z.string(),
    date: isoDate,
    type: z.enum(["off", "want", "ng", "ngTime"]),
    from: optionalTime,
    to: optionalTime,
  })
  .superRefine((r, ctx) => {
    if (r.type !== "ngTime") return;
    if (!r.from) ctx.addIssue({ code: "custom", message: "開始時刻を入力してください", path: ["from"] });
    if (!r.to) ctx.addIssue({ code: "custom", message: "終了時刻を入力してください", path: ["to"] });
    if (r.from && r.to && r.from >= r.to) {
      ctx.addIssue({ code: "custom", message: "終わりを始まりより後にしてください", path: ["to"] });
    }
  });

export type ShiftRequest = z.infer<typeof shiftRequestSchema>;

// ---------------------------------------------------------------- 基本情報

export const profileSchema = z.object({
  storeName: z.string().trim().min(1, "店舗名を入力してください").max(40, "40文字以内にしてください"),
});

export type Profile = z.infer<typeof profileSchema>;

// ---------------------------------------------------------------- 手で直した勤務

export const shiftFixSchema = z
  .object({
    staffId: z.string(),
    date: isoDate,
    off: z.boolean(),
    from: optionalTime,
    to: optionalTime,
  })
  .superRefine((f, ctx) => {
    if (f.off) return;
    if (!f.from) ctx.addIssue({ code: "custom", message: "始まりを選んでください", path: ["from"] });
    if (!f.to) ctx.addIssue({ code: "custom", message: "終わりを選んでください", path: ["to"] });
    if (f.from && f.to && f.from === f.to) {
      ctx.addIssue({ code: "custom", message: "始まりと終わりが同じです", path: ["to"] });
    }
  });

/** 作成したシフトを手で直した内容。作り直すときも、この内容で固定する */
export type ShiftFix = z.infer<typeof shiftFixSchema>;
