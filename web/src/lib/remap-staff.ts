import type { Staff } from "./schema";
import type { SolveResult, ViewData } from "./types";

/**
 * 作成したシフトを、いまのスタッフ一覧に合わせる。
 * エンジンは名前で結果を返すので、作成したときの「名前 → スタッフID」を覚えておき、
 * 名前を変えても同じ人として表示する。
 * - 作成後に名前を変えた人: 新しい名前で表示
 * - 作成後に追加した人: 空の行で表示（手で勤務を入れられる）
 * - 作成後に削除した人: 表示しない
 */
export function withCurrentStaff(result: SolveResult, staff: Staff[]): ViewData {
  const data = result.data;
  // 古い版で作った結果には staffIds がないので、名前で対応させる
  const idByOldName: Record<string, string> =
    result.staffIds ?? Object.fromEntries(staff.map((s) => [s.name, s.id]));
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const rename = (old: string) => nameById.get(idByOldName[old]) ?? null;

  const assign: ViewData["assign"] = {};
  for (const [k, code] of Object.entries(data.assign)) {
    const i = k.lastIndexOf("|");
    const name = rename(k.slice(0, i));
    if (name) assign[`${name}|${k.slice(i + 1)}`] = code;
  }

  const statsByNewName = new Map<string, ViewData["staff"][number]>();
  for (const s of data.staff) {
    const name = rename(s.name);
    if (name) statsByNewName.set(name, { ...s, name });
  }
  const staffRows = staff.map((s) => statsByNewName.get(s.name) ?? { name: s.name, days: 0, hours: 0, weekend: 0 });

  const renamed = data.staff
    .map((s) => [s.name, rename(s.name)] as const)
    .filter(([old, now]) => now && now !== old)
    .sort((a, b) => b[0].length - a[0].length);
  const warnings = data.warnings.map((w) => {
    for (const [old, now] of renamed) if (w.startsWith(`${old} `)) return now + w.slice(old.length);
    return w;
  });

  return { ...data, assign, staff: staffRows, warnings };
}
