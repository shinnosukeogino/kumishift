"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { TimeSelect } from "@/components/app/time-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { breakFor } from "@/lib/apply-fixes";
import { hm } from "@/lib/dates";
import { REQUEST_TYPES, shiftFixSchema, toMinutes, type ShiftFix } from "@/lib/schema";
import { useAppStore } from "@/lib/store";
import type { ViewData } from "@/lib/types";

export type EditTarget = { name: string; date: string } | null;

/** 手で直すときは、時間の区切りに関係なく15分単位で選べる */
const EDIT_STEP = 15;

export function ShiftEditDialog({ target, data, onClose }: { target: EditTarget; data: ViewData; onClose: () => void }) {
  const staff = useAppStore((s) => s.staff);
  const fixes = useAppStore((s) => s.fixes);
  const requests = useAppStore((s) => s.requests);
  const step = useAppStore((s) => s.businessHours.stepMinutes);
  const setFix = useAppStore((s) => s.setFix);
  const removeFix = useAppStore((s) => s.removeFix);

  const member = target ? staff.find((s) => s.name === target.name) : undefined;
  const day = target ? data.days.find((d) => d.date === target.date) : undefined;
  const current = target ? data.assign[`${target.name}|${target.date}`] : undefined;
  const currentShift = current ? data.shifts[current] : undefined;
  const existingFix = member && target ? fixes.find((f) => f.staffId === member.id && f.date === target.date) : undefined;
  const request = member && target ? requests.find((r) => r.staffId === member.id && r.date === target.date) : undefined;

  const form = useForm<ShiftFix>({
    resolver: zodResolver(shiftFixSchema),
    defaultValues: { staffId: "", date: "", off: false, from: "", to: "" },
  });

  React.useEffect(() => {
    if (!target || !member) return;
    const o = day?.open ?? 10 * 60;
    form.reset({
      staffId: member.id,
      date: target.date,
      off: !currentShift,
      from: currentShift ? hm(currentShift.start) : hm(o),
      to: currentShift ? hm(currentShift.end) : hm(Math.min(o + 4 * 60, day?.close ?? o + 240)),
    });
  }, [target, member, currentShift, day, form]);

  const off = useWatch({ control: form.control, name: "off" });
  const from = useWatch({ control: form.control, name: "from" });
  const to = useWatch({ control: form.control, name: "to" });

  // 確認したほうがよいこと（保存はできる）
  const notes: string[] = [];
  if (target && member && day) {
    if (!off && from && to && from !== to) {
      const s = toMinutes(from);
      let e = toMinutes(to);
      if (e <= s) e += 1440;
      if (day.closed) notes.push("この日は休業日です");
      else if (day.open != null && day.close != null && (s < day.open || e > day.close)) {
        notes.push(`営業時間（${hm(day.open)}〜${hm(day.close)}）の外にかかっています`);
      }
      for (const [bf, bt] of day.breaks ?? []) {
        if (s < bt && bf < e) notes.push(`中休み（${hm(bf)}〜${hm(bt)}）にかかっています`);
      }
      if (s % step || e % step) {
        notes.push(
          `${step}分の区切りの途中にかかる時間帯は、人数に数えません（例: 10:15から入ると、10時台の人数には入りません）`,
        );
      }
      const br = breakFor(e - s, data.breakRules);
      notes.push(`勤務 ${(e - s) / 60}時間${br ? `（休憩${br}分・実働${(e - s - br) / 60}時間）` : ""}`);
      if (request && request.type !== "want") {
        notes.push(`${member.name} さんはこの日「${REQUEST_TYPES[request.type].label}」を出しています`);
      }
      const wd = (new Date(`${target.date}T00:00:00`).getDay() + 6) % 7;
      if (!member.weekdays.includes(wd)) notes.push("ふだんは出勤しない曜日です");
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target?.name} さん・{day?.label}（{day?.wd}）
          </DialogTitle>
          <DialogDescription>
            {currentShift ? `いまは ${hm(currentShift.start)}〜${hm(currentShift.end)}` : "いまは休み"}
            {existingFix ? "（手で直した内容）" : "（自動で作った内容）"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => {
              setFix(v.off ? { ...v, from: "", to: "" } : v);
              onClose();
            })}
          >
            <FormField
              control={form.control}
              name="off"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={field.value ? "off" : "work"}
                      onValueChange={(v) => v && field.onChange(v === "off")}
                      aria-label="出勤か休みか"
                    >
                      {[
                        ["work", "出勤"],
                        ["off", "休み"],
                      ].map(([v, label]) => (
                        <ToggleGroupItem key={v} value={v} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-20">
                          {label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </FormControl>
                </FormItem>
              )}
            />
            {!off && (
              <div className="flex items-start gap-2">
                <FormField
                  control={form.control}
                  name="from"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>から</FormLabel>
                      <FormControl>
                        <TimeSelect step={EDIT_STEP} className="w-full" value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <span className="pt-8">〜</span>
                <FormField
                  control={form.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>まで</FormLabel>
                      <FormControl>
                        <TimeSelect step={EDIT_STEP} className="w-full" value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            {notes.length > 0 && (
              <ul className="text-muted-foreground space-y-1 text-xs">
                {notes.map((n) => (
                  <li key={n} className={n.startsWith("勤務 ") ? "" : "flex items-center gap-1.5 text-amber-700 dark:text-amber-300"}>
                    {!n.startsWith("勤務 ") && <AlertTriangle className="size-3.5 shrink-0" />}
                    {n}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground text-xs">手で直した内容は、「作り直す」を押してもそのまま残ります。ほかの人のシフトはそれに合わせて組み直します。</p>
            <DialogFooter className="sm:justify-between">
              {existingFix ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (member && target) removeFix(member.id, target.date);
                    onClose();
                  }}
                >
                  <RotateCcw />
                  自動に戻す
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  キャンセル
                </Button>
                <Button type="submit">保存</Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
