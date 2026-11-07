"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Ban, CalendarHeart, CalendarOff, Clock, Eraser, Trash2 } from "lucide-react";

import { MonthSwitcher } from "@/components/app/month-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { monthCalendar } from "@/lib/calendar";
import { dayLabel, monthLabel } from "@/lib/dates";
import { WEEKDAYS, type RequestType, type ShiftRequest } from "@/lib/schema";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

import { TimeNgDialog } from "./time-ng-dialog";

type Mode = RequestType | "erase";

const MODES: { value: Mode; label: string; icon: React.ElementType; hint: string }[] = [
  { value: "off", label: "休み希望", icon: CalendarOff, hint: "この日は休みたい" },
  { value: "want", label: "出勤希望", icon: CalendarHeart, hint: "この日に出勤したい（できるだけ反映）" },
  { value: "ng", label: "NG（終日）", icon: Ban, hint: "この日は絶対に入れない" },
  { value: "ngTime", label: "時間NG", icon: Clock, hint: "この時間だけ入れない" },
  { value: "erase", label: "消す", icon: Eraser, hint: "入力を消す" },
];

const CELL: Record<RequestType, { text: string; className: string }> = {
  off: { text: "休", className: "bg-destructive/10 text-destructive border-destructive/30" },
  want: { text: "出", className: "bg-primary/10 text-primary border-primary/30" },
  ng: { text: "NG", className: "bg-foreground/80 text-background border-transparent" },
  ngTime: { text: "", className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200" },
};

export function RequestGrid() {
  const month = useAppStore((s) => s.month);
  const staff = useAppStore((s) => s.staff);
  const requests = useAppStore((s) => s.requests);
  const bh = useAppStore((s) => s.businessHours);
  const special = useAppStore((s) => s.specialDays);
  const setRequest = useAppStore((s) => s.setRequest);
  const removeRequest = useAppStore((s) => s.removeRequest);
  const clearRequests = useAppStore((s) => s.clearRequests);

  const [mode, setMode] = React.useState<Mode>("off");
  const [timeTarget, setTimeTarget] = React.useState<React.ComponentProps<typeof TimeNgDialog>["target"]>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);
  // ドラッグで塗るときの動作（最初のマスで「付ける」か「消す」かを決める）
  const paint = React.useRef<null | "set" | "erase">(null);

  const days = React.useMemo(() => monthCalendar(month, bh, special), [month, bh, special]);
  const byKey = React.useMemo(() => {
    const m = new Map<string, ShiftRequest>();
    for (const r of requests) if (r.date.startsWith(month)) m.set(`${r.staffId}|${r.date}`, r);
    return m;
  }, [requests, month]);
  const monthCount = byKey.size;

  React.useEffect(() => {
    const up = () => (paint.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const apply = (staffId: string, date: string, action: "set" | "erase") => {
    if (action === "erase" || mode === "erase") removeRequest(staffId, date);
    else if (mode !== "ngTime") setRequest({ staffId, date, type: mode, from: "", to: "" });
  };

  const onDown = (staffId: string, staffName: string, date: string) => {
    const cur = byKey.get(`${staffId}|${date}`);
    if (mode === "ngTime") {
      setTimeTarget({ staffId, staffName, date, from: cur?.type === "ngTime" ? cur.from : undefined, to: cur?.type === "ngTime" ? cur.to : undefined });
      return;
    }
    const action = mode === "erase" || cur?.type === mode ? "erase" : "set";
    paint.current = action;
    apply(staffId, date, action);
  };

  const onEnter = (staffId: string, date: string) => {
    if (paint.current) apply(staffId, date, paint.current);
  };

  return (
    <div className="space-y-4">
      <Card className="no-print py-4">
        <CardContent className="flex flex-wrap items-center gap-4 px-4">
          <MonthSwitcher />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">入力するもの</span>
            <ToggleGroup type="single" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as Mode)} aria-label="入力するもの">
              {MODES.map(({ value, label, icon: Icon }) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground gap-1.5 px-3"
                >
                  <Icon className="size-4" />
                  <span className="hidden md:inline">{label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <span className="text-muted-foreground text-sm">{MODES.find((m) => m.value === mode)?.hint}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" disabled={monthCount === 0} onClick={() => setConfirmClear(true)}>
              <Trash2 />
              この月の入力を消す
            </Button>
            <Button asChild size="sm">
              <Link href="/">
                シフトを作成
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-xs select-none" onPointerLeave={() => (paint.current = null)}>
            <thead>
              <tr>
                <th className="bg-card sticky left-0 z-20 min-w-24 border-b px-3 py-2 text-left font-semibold">名前</th>
                {days.map((d) => (
                  <th
                    key={d.date}
                    title={d.holiday ?? d.closedReason ?? undefined}
                    className={cn(
                      "min-w-9 border-b px-0.5 py-2 text-center font-semibold",
                      (d.weekday >= 5 || d.holiday) && "bg-muted/60",
                    )}
                  >
                    <div className="tabular-nums">{dayLabel(d.date).split("/")[1]}</div>
                    <div className={cn(d.weekday === 5 && "text-blue-600", (d.weekday === 6 || d.holiday) && "text-red-600")}>
                      {d.holiday ? "祝" : WEEKDAYS[d.weekday]}
                    </div>
                  </th>
                ))}
                <th className="bg-card sticky right-0 z-20 border-b border-l px-3 py-2 text-center font-semibold">休み</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const offs = days.filter((d) => byKey.get(`${s.id}|${d.date}`)?.type === "off").length;
                return (
                  <tr key={s.id} className="group">
                    <th className="bg-card group-hover:bg-muted sticky left-0 z-10 border-b px-3 py-1.5 text-left text-sm font-semibold whitespace-nowrap">
                      {s.name}
                    </th>
                    {days.map((d) => {
                      const r = byKey.get(`${s.id}|${d.date}`);
                      const unavailable = !s.weekdays.includes(d.weekday);
                      if (d.closed) {
                        return (
                          <td key={d.date} className="border-b p-0.5" title={d.closedReason ?? undefined}>
                            <div className="text-muted-foreground grid h-9 place-items-center rounded bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_4px,transparent_4px,transparent_8px)]">
                              休
                            </div>
                          </td>
                        );
                      }
                      const cell = r ? CELL[r.type] : null;
                      return (
                        <td key={d.date} className={cn("border-b p-0.5", (d.weekday >= 5 || d.holiday) && "bg-muted/30")}>
                          <button
                            type="button"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              onDown(s.id, s.name, d.date);
                            }}
                            onPointerEnter={() => onEnter(s.id, d.date)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onDown(s.id, s.name, d.date);
                                paint.current = null;
                              }
                            }}
                            aria-label={`${s.name} ${dayLabel(d.date)} ${r ? (r.type === "ngTime" ? `${r.from}〜${r.to} NG` : CELL[r.type].text) : "入力なし"}`}
                            title={unavailable ? "ふだんは出勤しない曜日です" : r?.type === "ngTime" ? `${r.from}〜${r.to} は入れない` : undefined}
                            className={cn(
                              "focus-visible:ring-ring/50 grid h-9 w-full place-items-center rounded border text-[11px] leading-tight font-bold transition-colors outline-none focus-visible:ring-[3px]",
                              cell?.className ?? "hover:bg-accent border-transparent",
                              !cell && unavailable && "text-muted-foreground/50",
                            )}
                          >
                            {r?.type === "ngTime" ? (
                              <span className="font-semibold">
                                {r.from.replace(/^0/, "").replace(":00", "")}
                                <br />-{r.to.replace(/^0/, "").replace(":00", "")}
                              </span>
                            ) : (
                              (cell?.text ?? (unavailable ? "×" : ""))
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="bg-card sticky right-0 z-10 border-b border-l px-3 text-center text-sm tabular-nums">{offs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        {(Object.keys(CELL) as RequestType[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn("grid h-5 min-w-7 place-items-center rounded border px-1 text-[10px] font-bold", CELL[k].className)}>
              {k === "ngTime" ? "17-21" : CELL[k].text}
            </span>
            {MODES.find((m) => m.value === k)?.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="grid h-5 min-w-7 place-items-center rounded border border-dashed px-1">×</span>
          ふだん出勤しない曜日（設定の「スタッフ」で変更）
        </span>
        <span>ドラッグでまとめて入力できます。もう一度押すと消えます。</span>
      </div>

      <TimeNgDialog target={timeTarget} onClose={() => setTimeTarget(null)} />

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{monthLabel(month)}の入力をすべて消しますか？</DialogTitle>
            <DialogDescription>{monthCount}件の休み希望などが消えます。元に戻せません。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearRequests(month);
                setConfirmClear(false);
              }}
            >
              消す
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
