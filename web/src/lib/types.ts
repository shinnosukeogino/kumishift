/** API（POST /api/solve）が返すシフト表のデータ。src/kumishift/html.py の to_view_data と同じ形 */
export type ViewDay = {
  date: string;
  label: string;
  wd: string;
  weekend: boolean;
  closed: boolean;
  open: number | null;
  close: number | null;
  slots: { t: number; need: number }[];
  /** 中休み [開始分, 終了分] */
  breaks?: [number, number][];
  need: Record<string, number>;
};

/** break: 休憩（分）。勤務時間から差し引く */
export type ViewShift = { name: string; start: number; end: number; break?: number };

export type ViewData = {
  version: string;
  status: string;
  hourly: boolean;
  step: number;
  period: [string, string];
  days: ViewDay[];
  shifts: Record<string, ViewShift>;
  shiftOrder: string[];
  staff: { name: string; days: number; hours: number; weekend: number }[];
  /** "名前|2027-01-04" -> 勤務コード（例: "10-15"） */
  assign: Record<string, string>;
  shortages: { date: string; shift: string; need: number; assigned: number }[];
  warnings: string[];
  breakRules?: { overMinutes: number; minutes: number }[];
};

export type SolveResult = {
  month: string;
  createdAt: string;
  /** 作成したときの条件（変わったら「作り直してください」を出す） */
  configKey: string;
  /** 作成したときの手で直した内容（変わったら「作り直すと反映」を出す） */
  fixesKey?: string;
  data: ViewData;
};
