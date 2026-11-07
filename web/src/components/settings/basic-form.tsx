"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { NumberInput } from "@/components/app/number-input";
import { SaveBar, useSavedFlash } from "@/components/app/save-bar";
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {num("minHours", "1回の勤務の最短", "時間")}
              {num("maxHours", "1回の勤務の最長", "時間")}
              {num("maxConsecutive", "最大連勤", "日", "これより長く続けて出勤しません")}
              {num("timeLimitSeconds", "計算の制限時間", "秒", "長いほど良い案を探します")}
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
