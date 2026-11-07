"use client";

import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Coffee, Plus, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";

import { NumberInput } from "@/components/app/number-input";
import { SaveBar, useSavedFlash } from "@/components/app/save-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { profileSchema, workRulesSchema, type Profile, type WorkRules } from "@/lib/schema";
import { useAppStore } from "@/lib/store";

export function ProfileForm() {
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const [saved, flash] = useSavedFlash();
  const form = useForm<Profile>({ resolver: zodResolver(profileSchema), defaultValues: profile });

  return (
    <Card>
      <CardHeader>
        <CardTitle>店舗</CardTitle>
        <CardDescription>シフト表の見出しに表示されます。</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => {
              setProfile(v);
              form.reset(v);
              flash();
            })}
          >
            <FormField
              control={form.control}
              name="storeName"
              render={({ field }) => (
                <FormItem className="max-w-sm">
                  <FormLabel>店舗名</FormLabel>
                  <FormControl>
                    <Input placeholder="例: カフェ なかもず店" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SaveBar dirty={form.formState.isDirty} saved={saved} onReset={() => form.reset(profile)} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export function WorkRulesForm() {
  const rules = useAppStore((s) => s.workRules);
  const setRules = useAppStore((s) => s.setWorkRules);
  const [saved, flash] = useSavedFlash();
  const form = useForm<WorkRules>({ resolver: zodResolver(workRulesSchema), defaultValues: rules });
  const breaks = useFieldArray({ control: form.control, name: "breakRules" });

  const num = (name: "minHours" | "maxHours" | "maxConsecutive" | "timeLimitSeconds", label: string, suffix: string, desc?: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <NumberInput nullable={false} suffix={suffix} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} className="w-24" />
          </FormControl>
          {desc && <FormDescription>{desc}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>勤務のルール</CardTitle>
        <CardDescription>全員に共通するルールです。スタッフごとの上限は「スタッフ」タブで決められます。</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit((v) => {
              setRules(v);
              form.reset(v);
              flash();
            })}
          >
            <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {num("minHours", "1回の勤務の最短", "時間")}
              {num("maxHours", "1回の勤務の最長", "時間")}
              {num("maxConsecutive", "最大連勤", "日", "これより長く続けて出勤しません")}
              {num("timeLimitSeconds", "計算の制限時間", "秒", "長いほど良い案を探します")}
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2 font-medium">
                <Coffee className="size-4" />
                休憩
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                勤務の長さに応じて休憩を取ります。休憩は勤務時間から差し引いて数えます（週の上限・合計時間など）。
                労働基準法では、6時間を超えると45分以上、8時間を超えると1時間以上の休憩が必要です。休憩を取る時間帯は決めません。
              </p>
              {breaks.fields.map((f, i) => (
                <div key={f.id} className="flex flex-wrap items-start gap-2 text-sm">
                  <span className="pt-2">勤務が</span>
                  <FormField
                    control={form.control}
                    name={`breakRules.${i}.overHours`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <NumberInput nullable={false} aria-label="この時間を超えたら" className="w-20" value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <span className="pt-2">時間を超えたら、休憩</span>
                  <FormField
                    control={form.control}
                    name={`breakRules.${i}.minutes`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <NumberInput nullable={false} aria-label="休憩の分数" className="w-20" value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <span className="pt-2">分</span>
                  <Button type="button" variant="ghost" size="icon" aria-label="この休憩のルールを消す" onClick={() => breaks.remove(i)}>
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {breaks.fields.length === 0 && <p className="text-muted-foreground text-sm">休憩のルールはありません（休憩を差し引きません）</p>}
              {breaks.fields.length < 5 && (
                <Button type="button" variant="outline" size="sm" onClick={() => breaks.append({ overHours: 6, minutes: 45 })}>
                  <Plus />
                  ルールを追加
                </Button>
              )}
            </div>

            <FormField
              control={form.control}
              name="hopeOffHard"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <FormLabel>休み希望を必ず守る</FormLabel>
                    <FormDescription>オフにすると、人が足りないときは休み希望の日にも入れることがあります。</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <SaveBar dirty={form.formState.isDirty} saved={saved} onReset={() => form.reset(rules)} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
