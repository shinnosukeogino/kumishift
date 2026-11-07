"use client";

import * as React from "react";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";

import { SaveBar, useSavedFlash } from "@/components/app/save-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { weekdayLabel } from "@/lib/dates";
import { JP_HOLIDAYS } from "@/lib/jp-holidays";
import { specialDaysSchema, type SpecialDays } from "@/lib/schema";
import { useAppStore } from "@/lib/store";

export function SpecialDaysForm() {
  const value = useAppStore((s) => s.specialDays);
  const setValue = useAppStore((s) => s.setSpecialDays);
  const [saved, flash] = useSavedFlash();
  const form = useForm<SpecialDays>({ resolver: zodResolver(specialDaysSchema), defaultValues: value });

  return (
    <Form {...form}>
      <form
        className="grid gap-6 lg:grid-cols-2"
        onSubmit={form.handleSubmit((v) => {
          const sort = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);
          const next = { holidays: [...v.holidays].sort(sort), closedDates: [...v.closedDates].sort(sort) };
          setValue(next);
          form.reset(next);
          flash();
        })}
      >
        <DateList
          form={form}
          name="holidays"
          title="祝日"
          description="祝日は営業時間・必要人数で「祝」の設定が使われ、土日祝の出勤日数の平等化にも入ります。"
          extra={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const have = new Set(form.getValues("holidays").map((h) => h.date));
                const add = JP_HOLIDAYS.filter((h) => !have.has(h.date));
                form.setValue("holidays", [...form.getValues("holidays"), ...add], { shouldDirty: true });
              }}
            >
              <CalendarPlus />
              日本の祝日を入れる
            </Button>
          }
        />
        <DateList
          form={form}
          name="closedDates"
          title="臨時休業日"
          description="年末年始やお盆など、ふだんの定休日以外で休む日です。"
        />
        <div className="lg:col-span-2">
          <SaveBar dirty={form.formState.isDirty} saved={saved} onReset={() => form.reset(value)} />
        </div>
      </form>
    </Form>
  );
}

function DateList({
  form,
  name,
  title,
  description,
  extra,
}: {
  form: UseFormReturn<SpecialDays>;
  name: "holidays" | "closedDates";
  title: string;
  description: string;
  extra?: React.ReactNode;
}) {
  const list = useFieldArray({ control: form.control, name });
  const values = form.watch(name);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title}（{list.fields.length}日）
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {list.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[10rem_2rem_1fr_2.25rem] items-start gap-2">
              <FormField
                control={form.control}
                name={`${name}.${i}.date`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input type="date" aria-label="日付" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <span className="text-muted-foreground pt-2 text-sm">{values?.[i]?.date ? weekdayLabel(values[i].date) : ""}</span>
              <FormField
                control={form.control}
                name={`${name}.${i}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="名前（任意）" aria-label="名前" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" variant="ghost" size="icon" aria-label="削除" onClick={() => list.remove(i)}>
                <Trash2 className="text-muted-foreground" />
              </Button>
            </div>
          ))}
          {list.fields.length === 0 && <p className="text-muted-foreground py-4 text-sm">まだありません</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => list.append({ date: "", name: "" })}>
            <Plus />
            日付を追加
          </Button>
          {extra}
        </div>
      </CardContent>
    </Card>
  );
}
