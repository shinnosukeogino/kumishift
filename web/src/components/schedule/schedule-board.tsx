"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Printer, RefreshCw, RotateCcw, Sparkles } from "lucide-react";

import { MonthSwitcher } from "@/components/app/month-switcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, solveShift } from "@/lib/api";
import { applyFixes } from "@/lib/apply-fixes";
import { withCurrentStaff } from "@/lib/remap-staff";
import { monthLabel } from "@/lib/dates";
import { useAppStore } from "@/lib/store";
import { toEngineConfig } from "@/lib/to-config";

import { CalendarView } from "./calendar-view";
import { DayView } from "./day-view";
import { ExportDialog } from "./export-dialog";
import { PrintSheet, type PrintKind } from "./print-sheet";
import { ShiftEditDialog, type EditTarget } from "./shift-edit-dialog";
import { MonthView } from "./month-view";
import { StaffView } from "./staff-view";

export function ScheduleBoard() {
  const month = useAppStore((s) => s.month);
  // 月を切り替えたら、エラー表示や選んでいる日をリセットする
  return <Board key={month} />;
}

function Board() {
  const state = useAppStore();
  const { month, staff, setResult } = state;
  const result = state.results[month];
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("month");
  const [editing, setEditing] = React.useState<EditTarget>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [printOpen, setPrintOpen] = React.useState(false);
  const [printKind, setPrintKind] = React.useState<PrintKind>("calendar");
  const [dayIndex, setDayIndex] = React.useState(() =>
    result ? Math.max(0, result.data.days.findIndex((d) => !d.closed)) : 0,
  );

  const configInput = () => ({
    month,
    businessHours: state.businessHours,
    workRules: state.workRules,
    demand: state.demand,
    specialDays: state.specialDays,
    staff: state.staff,
    requests: state.requests,
  });
  // 「条件が変わったか」の判定には、手で直した内容は入れない（直した内容はすぐ表示に反映されるため）
  const config = React.useMemo(
    () => toEngineConfig(configInput()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, state.businessHours, state.workRules, state.demand, state.specialDays, state.staff, state.requests],
  );
  const configKey = React.useMemo(() => JSON.stringify(config), [config]);
  const stale = result && result.configKey !== configKey;
  const requestCount = state.requests.filter((r) => r.date.startsWith(month)).length;

  // 手で直した内容（作り直すときはエンジンに「固定」として渡す）
  const monthFixes = React.useMemo(() => state.fixes.filter((f) => f.date.startsWith(month)), [state.fixes, month]);
  const fixesKey = JSON.stringify([...monthFixes].sort((a, b) => (a.staffId + a.date).localeCompare(b.staffId + b.date)));
  const view = React.useMemo(
    () => (result ? applyFixes(withCurrentStaff(result, state.staff), monthFixes, state.staff) : null),
    [result, monthFixes, state.staff],
  );
  const fixesChanged = result && (result.fixesKey ?? "[]") !== fixesKey;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await solveShift(toEngineConfig({ ...configInput(), fixes: monthFixes }));
      const staffIds = Object.fromEntries(state.staff.map((s) => [s.name, s.id]));
      setResult({ month, createdAt: new Date().toISOString(), configKey, fixesKey, staffIds, data });
      setDayIndex(Math.max(0, data.days.findIndex((d) => !d.closed)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "シフトを作れませんでした。");
    } finally {
      setLoading(false);
    }
  };

  const pickDay = (i: number) => {
    setDayIndex(i);
    setTab("day");
  };
  const edit = (name: string, date: string) => setEditing({ name, date });

  if (staff.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <p className="text-muted-foreground">まずはスタッフを登録しましょう。</p>
          <Button asChild>
            <Link href="/settings">設定へ</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = view?.data;
  const edited = view?.edited ?? new Set<string>();
  const shortages = data?.shortages ?? [];
  const warnings = data?.warnings ?? [];

  return (
    <>
    <div className="space-y-4 print:hidden">
      <Card className="no-print py-4">
        <CardContent className="flex flex-wrap items-center gap-3 px-4">
          <MonthSwitcher />
          <span className="text-muted-foreground text-sm">
            スタッフ {staff.length}人・希望 {requestCount}件
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {result && (
              <span className="text-muted-foreground text-xs">
                {new Date(result.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} に作成
              </span>
            )}
            {data && (
              <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
                <Printer />
                書き出し・印刷
              </Button>
            )}
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : result ? <RefreshCw /> : <Sparkles />}
              {loading ? "作成中…" : result ? "作り直す" : "シフトを作成"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="border-destructive/20 bg-warn-bg">
          <AlertTriangle />
          <AlertTitle>シフトを作れませんでした</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {stale && !loading && (
        <Alert>
          <RefreshCw />
          <AlertTitle>作成したあとに条件が変わりました</AlertTitle>
          <AlertDescription>設定やシフト入力の変更を反映するには「作り直す」を押してください。手で直した勤務はそのまま残ります。</AlertDescription>
        </Alert>
      )}

      {data && monthFixes.length > 0 && (
        <Alert>
          <Pencil />
          <AlertTitle>手で直した勤務が {monthFixes.length}件 あります</AlertTitle>
          <AlertDescription>
            <p>
              黒い枠の勤務です。人数や時間の集計には反映済みです。
              {fixesChanged && " ほかの人の組み合わせも合わせて見直すときは「作り直す」を押してください（直した勤務は固定されます）。"}
            </p>
            <Button variant="outline" size="sm" className="mt-1" onClick={() => setConfirmReset(true)}>
              <RotateCcw />
              直した内容をすべて元に戻す
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Sparkles className="text-primary size-10" />
            <div>
              <p className="text-lg font-semibold">{monthLabel(month)}のシフトはまだありません</p>
              <p className="text-muted-foreground mt-1 text-sm">
                休み希望などを<Link href="/requests" className="text-primary underline-offset-4 hover:underline">シフト入力</Link>
                で入れてから、「シフトを作成」を押してください。
              </p>
            </div>
            <Button onClick={run} disabled={loading} size="lg">
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {loading ? "作成中…" : "シフトを作成"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {shortages.length || warnings.length ? (
            <Alert variant="destructive" className="border-destructive/20 bg-warn-bg">
              <AlertTriangle />
              <AlertTitle>
                確認が必要なことがあります（人数不足 {shortages.length}件・守れなかった希望 {warnings.length}件）
              </AlertTitle>
              <AlertDescription>
                <ul className="max-h-40 list-disc overflow-y-auto pl-5">
                  {shortages.slice(0, 50).map((s) => {
                    const d = data.days.find((x) => x.date === s.date);
                    return (
                      <li key={s.date + s.shift}>
                        {d?.label}({d?.wd}) {s.shift}: {s.assigned}/{s.need}人
                      </li>
                    );
                  })}
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-ok/20 bg-ok-bg text-ok">
              <CheckCircle2 />
              <AlertTitle>すべての時間帯が埋まり、希望もすべて守れました</AlertTitle>
            </Alert>
          )}

          <Card className="py-4">
            <CardContent className="px-4">
              <Tabs value={tab} onValueChange={setTab} className="gap-4">
                <div className="no-print flex items-center gap-3">
                  <TabsList>
                    <TabsTrigger value="month">月間</TabsTrigger>
                    <TabsTrigger value="calendar">カレンダー</TabsTrigger>
                    <TabsTrigger value="day">日別</TabsTrigger>
                    <TabsTrigger value="staff">スタッフ</TabsTrigger>
                  </TabsList>
                  <Badge variant="secondary" className={data.status === "最適" ? "bg-ok-bg text-ok" : undefined}>{data.status === "最適" ? "最適な組み合わせ" : "時間内の最良案"}</Badge>
                </div>
                <TabsContent value="month">
                  <MonthView data={data} edited={edited} onPickDay={pickDay} onEdit={edit} />
                </TabsContent>
                <TabsContent value="calendar">
                  <CalendarView data={data} edited={edited} onPickDay={pickDay} onEdit={edit} />
                </TabsContent>
                <TabsContent value="day">
                  <DayView
                    data={data}
                    edited={edited}
                    index={Math.min(dayIndex, data.days.length - 1)}
                    onIndex={setDayIndex}
                    onEdit={edit}
                  />
                </TabsContent>
                <TabsContent value="staff">
                  <StaffView data={data} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
      {data && <ShiftEditDialog target={editing} data={data} onClose={() => setEditing(null)} />}

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手で直した内容をすべて元に戻しますか？</DialogTitle>
            <DialogDescription>
              {monthLabel(month)}の{monthFixes.length}件が消え、自動で作った内容に戻ります。作り直したあとに直した勤務は、元に戻すと次の「作り直す」で組み直されます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                state.clearFixes(month);
                setConfirmReset(false);
              }}
            >
              元に戻す
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    {data && result && (
      <PrintSheet kind={printKind} data={data} storeName={state.profile.storeName} month={month} createdAt={result.createdAt} />
    )}
    {data && result && (
      <ExportDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        data={data}
        month={month}
        createdAt={result.createdAt}
        onPrint={(kind) => {
          setPrintKind(kind);
          // ダイアログが閉じてから印刷の画面を開く
          window.setTimeout(() => window.print(), 300);
        }}
      />
    )}
    </>
  );
}
