/**
 * 時間帯の色の候補。Tailwind はクラス名をそのまま書かないと CSS を作らないので、
 * 色ごとにクラスを並べて書いておく。
 * solid: 画面のチップ・バー（白い文字） / soft: 印刷（薄い背景・濃い文字） / dot: 凡例
 */
export const PALETTE = {
  blue: { label: "青", solid: "bg-blue-500 text-white", soft: "bg-blue-100 text-blue-950 border-blue-300", dot: "bg-blue-500" },
  sky: { label: "水色", solid: "bg-sky-500 text-white", soft: "bg-sky-100 text-sky-950 border-sky-300", dot: "bg-sky-500" },
  teal: { label: "青緑", solid: "bg-teal-500 text-white", soft: "bg-teal-100 text-teal-950 border-teal-300", dot: "bg-teal-500" },
  emerald: { label: "緑", solid: "bg-emerald-500 text-white", soft: "bg-emerald-100 text-emerald-950 border-emerald-300", dot: "bg-emerald-500" },
  lime: { label: "黄緑", solid: "bg-lime-600 text-white", soft: "bg-lime-100 text-lime-950 border-lime-300", dot: "bg-lime-600" },
  amber: { label: "黄", solid: "bg-amber-500 text-white", soft: "bg-amber-100 text-amber-950 border-amber-300", dot: "bg-amber-500" },
  orange: { label: "オレンジ", solid: "bg-orange-500 text-white", soft: "bg-orange-100 text-orange-950 border-orange-300", dot: "bg-orange-500" },
  rose: { label: "赤", solid: "bg-rose-500 text-white", soft: "bg-rose-100 text-rose-950 border-rose-300", dot: "bg-rose-500" },
  pink: { label: "ピンク", solid: "bg-pink-500 text-white", soft: "bg-pink-100 text-pink-950 border-pink-300", dot: "bg-pink-500" },
  violet: { label: "紫", solid: "bg-violet-500 text-white", soft: "bg-violet-100 text-violet-950 border-violet-300", dot: "bg-violet-500" },
  slate: { label: "グレー", solid: "bg-slate-500 text-white", soft: "bg-slate-100 text-slate-950 border-slate-300", dot: "bg-slate-500" },
} as const;

export type PaletteId = keyof typeof PALETTE;
export const PALETTE_IDS = Object.keys(PALETTE) as PaletteId[];
