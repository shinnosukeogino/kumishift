"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Printer, RefreshCw, Sparkles } from "lucide-react";

import { MonthSwitcher } from "@/components/app/month-switcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, solveShift } from "@/lib/api";
import { monthLabel } from "@/lib/dates";
import { useAppStore } from "@/lib/store";
import { toEngineConfig } from "@/lib/to-config";

import { DayView } from "./day-view";
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
  const [dayIndex, setDayIndex] = React.useState(() =>
    result ? Math.max(0, result.data.days.findIndex((d) => !d.closed)) : 0,
  );

  const config = React.useMemo(
    () =>
      toEngineConfig({
        month,
        businessHours: state.businessHours,
        workRules: state.workRules,
        demand: state.demand,
        specialDays: state.specialDays,
        staff: state.staff,
        requests: state.requests,
      }),
    [month, state.businessHours, state.workRules, state.demand, state.specialDays, state.staff, state.requests],
  );
  const configKey = React.useMemo(() => JSON.stringify(config), [config]);
  const stale = result && result.configKey !== configKey;
  const requestCount = state.requests.filter((r) => r.date.startsWith(month)).length;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await solveShift(config);
      setResult({ month, createdAt: new Date().toISOString(), configKey, data });
      setDayIndex(Math.max(0, data.days.findIndex((d) => !d.closed)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "シフトを作れませんでした。");
    } finally {
      setLoading(false);
    }
  };

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

  const data = result?.data;
  const shortages = data?.shortages ?? [];
  const warnings = data?.warnings ?? [];

  return (
    <div className="space-y-4">
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
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer />
                印刷
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
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>シフトを作れませんでした</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {stale && !loading && (
        <Alert>
          <RefreshCw />
          <AlertTitle>作成したあとに条件が変わりました</AlertTitle>
          <AlertDescription>設定やシフト入力の変更を反映するには「作り直す」を押してください。</AlertDescription>
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
            <Alert variant="destructive">
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
            <Alert variant="success">
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
                    <TabsTrigger value="day">日別</TabsTrigger>
                    <TabsTrigger value="staff">スタッフ</TabsTrigger>
                  </TabsList>
                  <Badge variant={data.status === "最適" ? "success" : "secondary"}>{data.status === "最適" ? "最適な組み合わせ" : "時間内の最良案"}</Badge>
                </div>
                <TabsContent value="month">
                  <MonthView
                    data={data}
                    onPickDay={(i) => {
                      setDayIndex(i);
                      setTab("day");
                    }}
                  />
                </TabsContent>
                <TabsContent value="day">
                  <DayView data={data} index={Math.min(dayIndex, data.days.length - 1)} onIndex={setDayIndex} />
                </TabsContent>
                <TabsContent value="staff">
                  <StaffView data={data} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
