"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { nextMonth } from "./dates";
import { JP_HOLIDAYS } from "./jp-holidays";
import type {
  BusinessHours,
  Demand,
  Profile,
  ShiftRequest,
  SpecialDays,
  Staff,
  WorkRules,
} from "./schema";
import type { SolveResult } from "./types";

// ---------------------------------------------------------------- 初期値（カフェのサンプル）

const open = (o: string, c: string) => ({ closed: false, open: o, close: c });

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  days: [
    open("10:00", "21:00"),
    open("10:00", "21:00"),
    { closed: true, open: "10:00", close: "21:00" },
    open("10:00", "21:00"),
    open("10:00", "21:00"),
    open("09:00", "22:00"),
    open("09:00", "20:00"),
  ],
  holidayMode: "sunday",
  stepMinutes: 60,
};

export const DEFAULT_WORK_RULES: WorkRules = {
  minHours: 4,
  maxHours: 8,
  maxConsecutive: 5,
  hopeOffHard: true,
  timeLimitSeconds: 15,
};

export const DEFAULT_DEMAND: Demand = {
  defaultCount: 1,
  rows: [
    { days: "毎日", from: "11:00", to: "14:00", count: 3 },
    { days: "毎日", from: "17:00", to: "20:00", count: 2 },
    { days: "土日祝", from: "11:00", to: "15:00", count: 4 },
    { days: "土日祝", from: "17:00", to: "20:00", count: 3 },
  ],
};

const staff = (id: string, name: string, extra: Partial<Staff> = {}): Staff => ({
  id,
  name,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  availableFrom: "",
  availableTo: "",
  minHoursPerDay: null,
  maxHoursPerDay: null,
  minDays: null,
  maxDays: null,
  maxHoursPerWeek: null,
  maxConsecutive: null,
  fair: true,
  memo: "",
  ...extra,
});

export const DEFAULT_STAFF: Staff[] = [
  staff("s1", "田中", { maxHoursPerWeek: 40, maxDays: 22, memo: "社員" }),
  staff("s2", "佐藤", { maxHoursPerWeek: 40, maxDays: 22, memo: "社員" }),
  staff("s3", "鈴木", { maxHoursPerWeek: 32 }),
  staff("s4", "高橋", { availableFrom: "17:00", weekdays: [0, 1, 3, 4], fair: false, memo: "学生" }),
  staff("s5", "伊藤", { availableFrom: "16:00", maxHoursPerDay: 5, fair: false, memo: "学生" }),
  staff("s6", "渡辺", { availableFrom: "10:00", availableTo: "15:00", maxHoursPerWeek: 20, fair: false, memo: "扶養内" }),
  staff("s7", "山本", { availableTo: "16:00", maxHoursPerDay: 5, fair: false }),
  staff("s8", "中村", { weekdays: [5, 6], fair: false, memo: "土日のみ" }),
];

// ---------------------------------------------------------------- ストア

type State = {
  profile: Profile;
  businessHours: BusinessHours;
  workRules: WorkRules;
  demand: Demand;
  specialDays: SpecialDays;
  staff: Staff[];
  requests: ShiftRequest[];
  month: string;
  results: Record<string, SolveResult>; // 月ごとの作成結果

  setProfile: (v: Profile) => void;
  setBusinessHours: (v: BusinessHours) => void;
  setWorkRules: (v: WorkRules) => void;
  setDemand: (v: Demand) => void;
  setSpecialDays: (v: SpecialDays) => void;
  upsertStaff: (v: Staff) => void;
  removeStaff: (id: string) => void;
  moveStaff: (id: string, diff: -1 | 1) => void;
  setRequest: (v: ShiftRequest) => void;
  removeRequest: (staffId: string, date: string) => void;
  clearRequests: (month: string) => void;
  setMonth: (month: string) => void;
  setResult: (r: SolveResult) => void;
  resetAll: () => void;
};

const initial = () => ({
  profile: { storeName: "サンプルカフェ" },
  businessHours: DEFAULT_BUSINESS_HOURS,
  workRules: DEFAULT_WORK_RULES,
  demand: DEFAULT_DEMAND,
  specialDays: { holidays: JP_HOLIDAYS, closedDates: [] } as SpecialDays,
  staff: DEFAULT_STAFF,
  requests: [] as ShiftRequest[],
  month: nextMonth(),
  results: {} as Record<string, SolveResult>,
});

export const useAppStore = create<State>()(
  persist(
    (set) => ({
      ...initial(),
      setProfile: (profile) => set({ profile }),
      setBusinessHours: (businessHours) => set({ businessHours }),
      setWorkRules: (workRules) => set({ workRules }),
      setDemand: (demand) => set({ demand }),
      setSpecialDays: (specialDays) => set({ specialDays }),
      upsertStaff: (v) =>
        set((s) => ({
          staff: s.staff.some((x) => x.id === v.id)
            ? s.staff.map((x) => (x.id === v.id ? v : x))
            : [...s.staff, v],
        })),
      removeStaff: (id) =>
        set((s) => ({
          staff: s.staff.filter((x) => x.id !== id),
          requests: s.requests.filter((r) => r.staffId !== id),
        })),
      moveStaff: (id, diff) =>
        set((s) => {
          const i = s.staff.findIndex((x) => x.id === id);
          const j = i + diff;
          if (i < 0 || j < 0 || j >= s.staff.length) return {};
          const next = [...s.staff];
          [next[i], next[j]] = [next[j], next[i]];
          return { staff: next };
        }),
      setRequest: (v) =>
        set((s) => ({
          requests: [...s.requests.filter((r) => !(r.staffId === v.staffId && r.date === v.date)), v],
        })),
      removeRequest: (staffId, date) =>
        set((s) => ({ requests: s.requests.filter((r) => !(r.staffId === staffId && r.date === date)) })),
      clearRequests: (month) => set((s) => ({ requests: s.requests.filter((r) => !r.date.startsWith(month)) })),
      setMonth: (month) => set({ month }),
      setResult: (r) => set((s) => ({ results: { ...s.results, [r.month]: r } })),
      resetAll: () => set(initial()),
    }),
    { name: "kumishift", version: 1 },
  ),
);

/** localStorage からの読み込みが終わったか（読み込み前に描画すると表示がずれるため） */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useAppStore.persist.onFinishHydration(cb),
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );
}

export const newId = () => Math.random().toString(36).slice(2, 10);
