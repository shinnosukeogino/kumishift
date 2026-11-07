"use client";

import * as React from "react";
import { toBlob } from "html-to-image";
import { CalendarPlus, FileSpreadsheet, ImageDown, Loader2, Printer } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { monthLabel } from "@/lib/dates";
import { buildIcs, buildListCsv, buildMonthCsv, downloadBlob, downloadText, listShifts, safeName } from "@/lib/export";
import { useAppStore } from "@/lib/store";
import type { ViewData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { PrintSheet, type PrintKind } from "./print-sheet";

type Format = "print" | "png" | "ics" | "csv";

const FORMATS: { value: Format; label: string; hint: string; icon: React.ElementType }[] = [
  { value: "print", label: "印刷・PDF", hint: "A4 横 1 枚", icon: Printer },
  { value: "png", label: "画像（PNG）", hint: "LINE などで送る", icon: ImageDown },
  { value: "ics", label: "カレンダー（.ics）", hint: "Google カレンダーなど", icon: CalendarPlus },
  { value: "csv", label: "Excel（CSV）", hint: "集計・給与計算", icon: FileSpreadsheet },
];

const ON = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

export function ExportDialog({
  open,
  onOpenChange,
  data,
  month,
  createdAt,
  onPrint,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ViewData;
  month: string;
  createdAt: string;
  /** 印刷するレイアウトを決めて印刷する */
  onPrint: (kind: PrintKind) => void;
}) {
  const storeName = useAppStore((s) => s.profile.storeName);
  const staff = useAppStore((s) => s.staff);
  const [format, setFormat] = React.useState<Format>("print");
  const [kind, setKind] = React.useState<PrintKind>("calendar");
  const [csvLayout, setCsvLayout] = React.useState<"month" | "list">("month");
  const [icsTarget, setIcsTarget] = React.useState<string>("all");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const imageRef = React.useRef<HTMLDivElement>(null);

  const base = `${safeName(storeName)}_${month}_シフト`;
  const idOf = (name: string) => staff.find((s) => s.name === name)?.id ?? name;
  const targetName = icsTarget === "all" ? null : staff.find((s) => s.id === icsTarget)?.name ?? null;
  const icsCount = listShifts(data, targetName ? [targetName] : undefined).length;

  const run = async () => {
    setError(null);
    if (format === "print") {
      onOpenChange(false);
      onPrint(kind);
      return;
    }
    if (format === "csv") {
      const text = csvLayout === "month" ? buildMonthCsv(data) : buildListCsv(data);
      downloadText(text, `${base}_${csvLayout === "month" ? "月間表" : "一覧"}.csv`, "text/csv;charset=utf-8", true);
      return;
    }
    if (format === "ics") {
      const text = buildIcs({ data, storeName, names: targetName ? [targetName] : undefined, idOf, personal: !!targetName });
      downloadText(text, `${base}_${targetName ?? "全員"}.ics`, "text/calendar;charset=utf-8");
      return;
    }
    // png
    if (!imageRef.current) return;
    setBusy(true);
    try {
      const blob = await toBlob(imageRef.current, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
      if (!blob) throw new Error();
      downloadBlob(blob, `${base}_${kind === "calendar" ? "カレンダー" : "月間表"}.png`);
    } catch {
      setError("画像を作れませんでした。もう一度試すか、印刷の「PDFに保存」を使ってください。");
    } finally {
      setBusy(false);
    }
  };

  const action =
    format === "print" ? "印刷する" : format === "png" ? "画像を保存" : format === "ics" ? "カレンダー用に書き出す" : "CSV を書き出す";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>書き出し・印刷</DialogTitle>
            <DialogDescription>{monthLabel(month)}のシフトを、使いたい形で書き出します。手で直した内容も入ります。</DialogDescription>
          </DialogHeader>

          <ToggleGroup
            type="single"
            variant="outline"
            value={format}
            onValueChange={(v) => v && setFormat(v as Format)}
            className="grid w-full grid-cols-2 sm:grid-cols-4"
            aria-label="書き出す形式"
          >
            {FORMATS.map(({ value, label, hint, icon: Icon }) => (
              <ToggleGroupItem key={value} value={value} aria-label={label} className={cn(ON, "h-auto flex-col gap-1 rounded-none! py-3")}>
                <Icon className="size-5" />
                <span className="text-xs font-semibold">{label}</span>
                <span className="text-[10px] opacity-80">{hint}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="space-y-4 rounded-lg border p-4">
            {(format === "print" || format === "png") && (
              <div className="space-y-2">
                <Label>レイアウト</Label>
                <ToggleGroup type="single" variant="outline" value={kind} onValueChange={(v) => v && setKind(v as PrintKind)} aria-label="レイアウト">
                  <ToggleGroupItem value="calendar" aria-label="カレンダー" className={cn(ON, "px-4")}>
                    カレンダー
                  </ToggleGroupItem>
                  <ToggleGroupItem value="month" aria-label="月間表" className={cn(ON, "px-4")}>
                    月間表
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="text-muted-foreground text-xs">
                  {format === "print"
                    ? "印刷の画面で「横向き」を選んでください。「PDFに保存」を選ぶと PDF になります。"
                    : "A4 横と同じ見た目の画像を保存します。"}
                </p>
              </div>
            )}

            {format === "ics" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>だれのシフト</Label>
                  <Select value={icsTarget} onValueChange={setIcsTarget}>
                    <SelectTrigger className="w-64" aria-label="だれのシフト">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全員分（お店用）</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} さんの分
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">{icsCount}件の勤務が予定になります。</p>
                </div>
                <div className="text-muted-foreground space-y-1 text-xs leading-relaxed">
                  <p className="text-foreground font-medium">Google カレンダーへの入れ方</p>
                  <p>パソコンで Google カレンダーを開き、右上の歯車 →「設定」→「インポート / エクスポート」で、書き出したファイルを選んで「インポート」します。</p>
                  <p>iPhone はファイルを開くと「カレンダーに追加」できます。Outlook はファイルをダブルクリックします。</p>
                  <p>
                    同じ勤務には同じ ID を付けているので、作り直したあとに取り込み直すと予定が更新されます（アプリによって動きが違います）。
                    なくなった勤務の予定は消えないので、カレンダーで削除してください。
                  </p>
                </div>
              </div>
            )}

            {format === "csv" && (
              <div className="space-y-2">
                <Label>形</Label>
                <ToggleGroup type="single" variant="outline" value={csvLayout} onValueChange={(v) => v && setCsvLayout(v as "month" | "list")} aria-label="CSV の形">
                  <ToggleGroupItem value="month" aria-label="月間表の形" className={cn(ON, "px-4")}>
                    月間表の形
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="1行1勤務の一覧" className={cn(ON, "px-4")}>
                    1行1勤務の一覧
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="text-muted-foreground text-xs">
                  {csvLayout === "month"
                    ? "スタッフ × 日付の表です。そのまま Excel や Google スプレッドシートで開けます。"
                    : "日付・名前・開始・終了・休憩・実働時間を1行ずつ並べます。給与計算や集計に向いています。"}
                </p>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="border-destructive/20 bg-warn-bg">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
            <Button onClick={run} disabled={busy || (format === "ics" && icsCount === 0)}>
              {busy && <Loader2 className="animate-spin" />}
              {action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 画像にするためのシフト表（画面の外に置く） */}
      {open && format === "png" && (
        <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
          <div ref={imageRef}>
            <PrintSheet mode="image" kind={kind} data={data} storeName={storeName} month={month} createdAt={createdAt} />
          </div>
        </div>
      )}
    </>
  );
}
