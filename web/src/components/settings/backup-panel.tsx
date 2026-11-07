"use client";

import * as React from "react";
import { AlertTriangle, Download, FileUp, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { backupFileName, downloadJson, makeBackup, parseBackup, type ParsedBackup } from "@/lib/backup";
import { monthLabel } from "@/lib/dates";
import { useAppStore, type State } from "@/lib/store";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function BackupPanel() {
  const lastBackupAt = useAppStore((s) => s.lastBackupAt);
  const storeName = useAppStore((s) => s.profile.storeName);
  const markBackedUp = useAppStore((s) => s.markBackedUp);
  const importAll = useAppStore((s) => s.importAll);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<ParsedBackup | null>(null);
  const [done, setDone] = React.useState(false);

  const exportNow = () => {
    const state = useAppStore.getState();
    downloadJson(makeBackup(state), backupFileName(state.profile.storeName));
    markBackedUp();
  };

  const onFile = async (file: File | undefined) => {
    setError(null);
    setDone(false);
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ファイルを読めませんでした。");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const p = pending?.data;
  const months = p ? Object.keys(p.results).sort() : [];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>バックアップを書き出す</CardTitle>
          <CardDescription>
            データはこのブラウザの中にだけ保存されています。ブラウザのデータを消したり、別のパソコンで開いたりすると見えなくなるので、ときどき書き出しておいてください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            書き出すもの: 設定（店舗・営業時間・必要人数・祝日・ルール）、スタッフ、シフト入力、手で直した勤務、作成したシフト
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={exportNow}>
              <Download />
              書き出す（.json）
            </Button>
            <span className="text-muted-foreground text-sm">
              {lastBackupAt ? `最後に書き出した日時: ${fmt(lastBackupAt)}` : "まだ書き出していません"}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">ファイル名の例: {backupFileName(storeName)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>バックアップを読み込む</CardTitle>
          <CardDescription>書き出したファイルを読み込むと、いまのデータはすべてファイルの内容に置き換わります。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
            aria-label="バックアップファイルを選ぶ"
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp />
            ファイルを選ぶ
          </Button>
          {error && (
            <Alert variant="destructive" className="border-destructive/20 bg-warn-bg">
              <AlertTriangle />
              <AlertTitle>読み込めませんでした</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {done && (
            <Alert className="border-ok/20 bg-ok-bg text-ok">
              <ShieldCheck />
              <AlertTitle>読み込みました</AlertTitle>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>このバックアップを読み込みますか？</DialogTitle>
            <DialogDescription>いまのデータはすべて置き換わります。元に戻せないので、心配なときは先にいまのデータを書き出してください。</DialogDescription>
          </DialogHeader>
          {p && (
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 rounded-lg border p-4 text-sm">
              <dt className="text-muted-foreground">書き出した日時</dt>
              <dd>{pending?.exportedAt ? fmt(pending.exportedAt) : "不明"}</dd>
              <dt className="text-muted-foreground">店舗名</dt>
              <dd>{p.profile.storeName}</dd>
              <dt className="text-muted-foreground">スタッフ</dt>
              <dd>{p.staff.length}人</dd>
              <dt className="text-muted-foreground">シフト入力</dt>
              <dd>{p.requests.length}件</dd>
              <dt className="text-muted-foreground">手で直した勤務</dt>
              <dd>{p.fixes.length}件</dd>
              <dt className="text-muted-foreground">作成したシフト</dt>
              <dd>{months.length ? months.map(monthLabel).join("、") : "なし"}</dd>
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={exportNow}>
              <Download />
              いまのデータを書き出す
            </Button>
            <Button
              onClick={() => {
                if (p) importAll(p as unknown as Partial<State>);
                setPending(null);
                setDone(true);
              }}
            >
              読み込む
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
