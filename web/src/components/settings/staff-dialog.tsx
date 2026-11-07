"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { NumberInput } from "@/components/app/number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TimeSelect } from "@/components/app/time-select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { staffSchema, WEEKDAYS, type Staff } from "@/lib/schema";
import { newId, useAppStore } from "@/lib/store";

export const emptyStaff = (): Staff => ({
  id: newId(),
  name: "",
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
});

type NumKey = "minHoursPerDay" | "maxHoursPerDay" | "minDays" | "maxDays" | "maxHoursPerWeek" | "maxConsecutive";

export function StaffDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Staff;
}) {
  const allStaff = useAppStore((s) => s.staff);
  const upsert = useAppStore((s) => s.upsertStaff);
  const step = useAppStore((s) => s.businessHours.stepMinutes);
  const isNew = !allStaff.some((s) => s.id === initial.id);

  const schema = React.useMemo(
    () =>
      staffSchema.superRefine((v, ctx) => {
        if (allStaff.some((s) => s.id !== v.id && s.name === v.name.trim())) {
          ctx.addIssue({ code: "custom", message: "同じ名前のスタッフがいます", path: ["name"] });
        }
      }),
    [allStaff],
  );
  const form = useForm<Staff>({ resolver: zodResolver(schema), defaultValues: initial });

  React.useEffect(() => {
    if (open) form.reset(initial);
  }, [open, initial, form]);

  const num = (name: NumKey, label: string, suffix: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <NumberInput suffix={suffix} placeholder="なし" value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "スタッフを追加" : `${initial.name} さんの設定`}</DialogTitle>
          <DialogDescription>ふだんの条件です。月ごとの休み希望などは「シフト入力」で入れます。空欄は制限なしです。</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit((v) => {
              upsert({ ...v, name: v.name.trim() });
              onOpenChange(false);
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名前</FormLabel>
                    <FormControl>
                      <Input placeholder="例: 田中" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="memo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メモ</FormLabel>
                    <FormControl>
                      <Input placeholder="例: 学生、扶養内" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="weekdays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>出勤できる曜日</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="multiple"
                      value={field.value.map(String)}
                      onValueChange={(v) => field.onChange(v.map(Number).sort())}
                      aria-label="出勤できる曜日"
                    >
                      {WEEKDAYS.map((w, i) => (
                        <ToggleGroupItem key={w} value={String(i)} aria-label={`${w}曜日`}>
                          {w}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem>
                <FormLabel>入れる時間帯</FormLabel>
                <div className="flex items-start gap-2">
                  <FormField
                    control={form.control}
                    name="availableFrom"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <TimeSelect step={step} allowEmpty emptyLabel="開店から" className="w-full" aria-label="入れる時間の始まり" value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <span className="pt-2">〜</span>
                  <FormField
                    control={form.control}
                    name="availableTo"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <TimeSelect step={step} allowEmpty emptyLabel="閉店まで" className="w-full" aria-label="入れる時間の終わり" value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormDescription>例: 学生は「17:00〜閉店まで」</FormDescription>
              </FormItem>
              <div className="grid grid-cols-2 gap-2">
                {num("minHoursPerDay", "1日の最短", "時間")}
                {num("maxHoursPerDay", "1日の最長", "時間")}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {num("minDays", "月の最低出勤", "日")}
              {num("maxDays", "月の最大出勤", "日")}
              {num("maxHoursPerWeek", "週の上限", "時間")}
              {num("maxConsecutive", "最大連勤", "日")}
            </div>

            <FormField
              control={form.control}
              name="fair"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <FormLabel>出勤日数・時間を平等にする対象</FormLabel>
                    <FormDescription>社員やフルタイムはオン、短時間のアルバイトはオフがおすすめです。</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button type="submit">{isNew ? "追加" : "保存"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
