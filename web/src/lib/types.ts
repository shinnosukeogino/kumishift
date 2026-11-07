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
  need: Record<string, number>;
};

export type ViewShift = { name: string; start: number; end: number };

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
};

export type SolveResult = {
  month: string;
  createdAt: string;
  /** 作成したときの条件（変わったら「作り直してください」を出す） */
  configKey: string;
  data: ViewData;
};
