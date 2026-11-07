import { z } from "zod";

import {
  businessHoursSchema,
  demandSchema,
  displaySchema,
  profileSchema,
  shiftFixSchema,
  shiftRequestSchema,
  specialDaysSchema,
  staffSchema,
  workRulesSchema,
} from "./schema";
import { migrateState, STORE_VERSION, type State } from "./store";

const APP = "kumishift";

/** バックアップに入れる項目 */
const KEYS = [
  "profile",
  "businessHours",
  "workRules",
  "demand",
  "display",
  "specialDays",
  "staff",
  "requests",
  "fixes",
  "results",
  "month",
] as const;

const backupDataSchema = z
  .object({
    profile: profileSchema,
    businessHours: businessHoursSchema,
    workRules: workRulesSchema,
    demand: demandSchema,
    display: displaySchema,
    specialDays: specialDaysSchema,
    staff: z.array(staffSchema),
    requests: z.array(shiftRequestSchema),
    fixes: z.array(shiftFixSchema),
    // 作成済みのシフトは画面に出すだけなので、形はゆるく確認する
    results: z.record(z.string(), z.object({ month: z.string(), createdAt: z.string(), data: z.object({}).passthrough() }).passthrough()),
    month: z.string().regex(/^\d{4}-\d{2}$/),
  })
  .superRefine((v, ctx) => {
    const names = v.staff.map((s) => s.name);
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: "custom", message: "同じ名前のスタッフがいます", path: ["staff"] });
    }
  });

export type BackupData = z.infer<typeof backupDataSchema>;

export function makeBackup(state: State) {
  const data = Object.fromEntries(KEYS.map((k) => [k, state[k]]));
  return { app: APP, version: STORE_VERSION, exportedAt: new Date().toISOString(), data };
}

export function backupFileName(storeName: string) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const safe = storeName.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 30) || "shift";
  return `kumishift_${safe}_${stamp}.json`;
}

/** ブラウザでファイルとして保存する */
export function downloadJson(obj: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ParsedBackup = { exportedAt: string | null; data: BackupData };

/** バックアップファイルを読んで確認する。問題があれば日本語のメッセージで Error を投げる */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("ファイルを読めませんでした。kumishift で書き出したファイル（.json）を選んでください。");
  }
  const obj = raw as { app?: unknown; version?: unknown; exportedAt?: unknown; data?: unknown };
  if (!obj || obj.app !== APP || typeof obj.data !== "object") {
    throw new Error("kumishift のバックアップファイルではありません。");
  }
  const version = typeof obj.version === "number" ? obj.version : 1;
  if (version > STORE_VERSION) {
    throw new Error("新しい版の kumishift で書き出したファイルです。kumishift を更新してから読み込んでください。");
  }
  const migrated = migrateState(obj.data, version);
  const result = backupDataSchema.safeParse(migrated);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.join(".");
    throw new Error(`ファイルの内容に問題があります（${where || "全体"}: ${issue.message}）`);
  }
  return { exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : null, data: result.data };
}
