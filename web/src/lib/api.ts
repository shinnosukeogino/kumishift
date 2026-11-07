import type { ViewData } from "./types";

export class ApiError extends Error {}

/** エンジンでシフトを作る。/api は next.config.ts で API サーバーに転送される */
export async function solveShift(config: unknown): Promise<ViewData> {
  let res: Response;
  try {
    res = await fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  } catch {
    throw new ApiError("API サーバーに接続できません。`kumishift serve` を起動してください。");
  }
  if (!res.ok) {
    let detail = `エラーが発生しました（${res.status}）`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      if (res.status >= 500) detail = "API サーバーに接続できません。`kumishift serve` を起動してください。";
    }
    throw new ApiError(detail);
  }
  return res.json();
}
