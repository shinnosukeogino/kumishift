"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, UserRound } from "lucide-react";

import { StaffAvatar } from "@/components/app/staff-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WEEKDAYS, type Staff } from "@/lib/schema";
import { useAppStore } from "@/lib/store";

import { emptyStaff, StaffDialog } from "./staff-dialog";

function summary(s: Staff) {
  const parts: string[] = [];
  if (s.weekdays.length < 7) parts.push(s.weekdays.map((i) => WEEKDAYS[i]).join("・"));
  else parts.push("毎日OK");
  if (s.availableFrom || s.availableTo) parts.push(`${s.availableFrom || "開店"}〜${s.availableTo || "閉店"}`);
  if (s.minHoursPerDay != null || s.maxHoursPerDay != null)
    parts.push(
      s.minHoursPerDay != null && s.maxHoursPerDay != null
        ? `1日${s.minHoursPerDay}〜${s.maxHoursPerDay}時間`
        : s.maxHoursPerDay != null
          ? `1日${s.maxHoursPerDay}時間まで`
          : `1日${s.minHoursPerDay}時間以上`,
    );
  if (s.minDays != null && s.maxDays != null) parts.push(`月${s.minDays}〜${s.maxDays}日`);
  else if (s.maxDays != null) parts.push(`月${s.maxDays}日まで`);
  else if (s.minDays != null) parts.push(`月${s.minDays}日以上`);
  if (s.maxHoursPerWeek != null) parts.push(`週${s.maxHoursPerWeek}時間まで`);
  if (s.maxConsecutive != null) parts.push(`${s.maxConsecutive}連勤まで`);
  return parts;
}

export function StaffList() {
  const staff = useAppStore((s) => s.staff);
  const remove = useAppStore((s) => s.removeStaff);
  const move = useAppStore((s) => s.moveStaff);
  const [editing, setEditing] = React.useState<Staff | null>(null);
  const [deleting, setDeleting] = React.useState<Staff | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>スタッフ（{staff.length}人）</CardTitle>
        <CardDescription>
          ふだんの条件（入れる曜日・時間帯・上限など）を決めます。並び順はシフト表の並び順になります。
          「日数そろえない」の人は、ほかの人と出勤日数・時間をそろえる計算に入らず、必要なところに必要なぶんだけ入ります。
        </CardDescription>
        <CardAction>
          <Button onClick={() => setEditing(emptyStaff())}>
            <Plus />
            スタッフを追加
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {staff.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed py-12">
            <UserRound className="size-8" />
            <p>まだスタッフがいません</p>
            <Button variant="outline" onClick={() => setEditing(emptyStaff())}>
              <Plus />
              最初のスタッフを追加
            </Button>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {staff.map((s, i) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <StaffAvatar name={s.name} icon={s.icon} className="size-9 text-sm" />
                <div className="min-w-32">
                  <div className="flex items-center gap-2 font-semibold">
                    {s.name}
                    {!s.fair && (
                      <Badge variant="secondary" title="ほかの人と出勤日数・時間をそろえる計算に入れません。必要なところに必要なぶんだけ入ります。">
                        日数そろえない
                      </Badge>
                    )}
                  </div>
                  {s.memo && <div className="text-muted-foreground text-xs">{s.memo}</div>}
                </div>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {summary(s).map((p) => (
                    <Badge key={p} variant="outline" className="font-normal">
                      {p}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="上へ" disabled={i === 0} onClick={() => move(s.id, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="下へ" disabled={i === staff.length - 1} onClick={() => move(s.id, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                    <Pencil />
                    編集
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`${s.name}を削除`} onClick={() => setDeleting(s)}>
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {editing && <StaffDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} initial={editing} />}

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleting?.name} さんを削除しますか？</DialogTitle>
            <DialogDescription>このスタッフの休み希望などの入力もすべて消えます。元に戻せません。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) remove(deleting.id);
                setDeleting(null);
              }}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
