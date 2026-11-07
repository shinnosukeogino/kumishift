"use client";

import * as React from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";

import { NumberInput } from "@/components/app/number-input";
import { SaveBar, useSavedFlash } from "@/components/app/save-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { TimeSelect } from "@/components/app/time-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hm } from "@/lib/dates";
import { previewDemand } from "@/lib/demand-preview";
import { DEMAND_DAYS, demandSchema, WEEKDAYS, type Demand } from "@/lib/schema";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function DemandForm() {
  const value = useAppStore((s) => s.demand);
  const setValue = useAppStore((s) => s.setDemand);
  const businessHours = useAppStore((s) => s.businessHours);
  const [saved, flash] = useSavedFlash();
  const form = useForm<Demand>({ resolver: zodResolver(demandSchema), defaultValues: value });
  const rows = useFieldArray({ control: form.control, name: "rows" });
  const watched = useWatch({ control: form.control }) as Demand;
  const step = businessHours.stepMinutes;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card>
        <CardHeader>
          <CardTitle>時間ごとの必要人数</CardTitle>
          <CardDescription>
            「毎日」をもとに、「平日」「土日祝」「曜日」「祝」の行で上書きします。指定しない時間は基本の人数になります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-6"
              onSubmit={form.handleSubmit((v) => {
                setValue(v);
                form.reset(v);
                flash();
              })}
            >
              <FormField
                control={form.control}
                name="defaultCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>基本の人数</FormLabel>
                    <FormControl>
                      <NumberInput nullable={false} suffix="人" className="w-24" value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                    </FormControl>
                    <FormDescription>営業時間中、下の表で指定しない時間に必要な人数です。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <div className="text-muted-foreground hidden grid-cols-[9rem_8rem_1rem_8rem_7rem_2.25rem] gap-2 px-1 text-xs sm:grid">
                  <span>対象の日</span>
                  <span>から</span>
                  <span />
                  <span>まで</span>
                  <span>人数</span>
                </div>
                {rows.fields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-2 items-start gap-2 rounded-lg border p-2 sm:grid-cols-[9rem_8rem_1rem_8rem_7rem_2.25rem] sm:border-0 sm:p-0">
                    <FormField
                      control={form.control}
                      name={`rows.${i}.days`}
                      render={({ field }) => (
                        <FormItem>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full" aria-label="対象の日">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DEMAND_DAYS.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {WEEKDAYS.includes(d as (typeof WEEKDAYS)[number]) ? `${d}曜日` : d === "祝" ? "祝日" : d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`rows.${i}.from`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <TimeSelect step={step} className="w-full" aria-label="開始" value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <span className="hidden pt-2 text-center sm:block">〜</span>
                    <FormField
                      control={form.control}
                      name={`rows.${i}.to`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <TimeSelect step={step} className="w-full" aria-label="終了" value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`rows.${i}.count`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <NumberInput nullable={false} suffix="人" aria-label="人数" value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" aria-label="この行を削除" onClick={() => rows.remove(i)}>
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => rows.append({ days: "毎日", from: "11:00", to: "14:00", count: 2 })}
                >
                  <Plus />
                  時間帯を追加
                </Button>
              </div>
              <SaveBar dirty={form.formState.isDirty} saved={saved} onReset={() => form.reset(value)} />
            </form>
          </Form>
        </CardContent>
      </Card>

      <DemandPreview demand={watched} />
    </div>
  );
}

function DemandPreview({ demand }: { demand: Demand }) {
  const bh = useAppStore((s) => s.businessHours);
  const safe: Demand = {
    defaultCount: Number.isFinite(demand?.defaultCount) ? demand.defaultCount : 0,
    rows: (demand?.rows ?? []).filter((r) => r?.from && r?.to && Number.isFinite(r?.count)),
  };
  const days = [...WEEKDAYS.map((w, i) => ({ label: w, i, holiday: false })), { label: "祝", i: 0, holiday: true }];
  const previews = days.map((d) => ({ ...d, p: previewDemand(bh, safe, d.i, d.holiday) }));
  const lo = Math.min(...previews.flatMap((x) => (x.p ? [x.p.open] : [])), 24 * 60);
  const hi = Math.max(...previews.flatMap((x) => (x.p ? [x.p.close] : [])), 0);
  const max = Math.max(1, ...previews.flatMap((x) => x.p?.slots.map((s) => s.need) ?? []));
  const pct = (m: number) => `${((m - lo) / Math.max(hi - lo, 1)) * 100}%`;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>プレビュー</CardTitle>
        <CardDescription>曜日ごとの必要人数です（濃いほど多い）。保存前の内容も反映されます。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-muted-foreground relative ml-8 h-4 text-[10px]">
          {hi > lo &&
            Array.from({ length: Math.floor((hi - lo) / 120) + 1 }, (_, k) => lo + k * 120).map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: pct(t) }}>
                {Math.floor(t / 60) % 24}
              </span>
            ))}
        </div>
        {previews.map(({ label, holiday, p }) => (
          <div key={label + holiday} className="flex items-center gap-2">
            <span className={cn("w-6 text-xs font-semibold", label === "土" && "text-blue-600", (label === "日" || label === "祝") && "text-red-600")}>
              {label}
            </span>
            <div className="bg-muted/60 relative h-7 flex-1 rounded">
              {p ? (
                p.slots.map((s) => (
                  <div
                    key={s.t}
                    title={`${hm(s.t)}〜${hm(s.t + p.step)}: ${s.need}人`}
                    className="bg-primary absolute top-0 flex h-full items-center justify-center border-r border-white/40 text-[10px] font-semibold text-white"
                    style={{ left: pct(s.t), width: `calc(${pct(s.t + p.step)} - ${pct(s.t)})`, opacity: 0.25 + (0.75 * s.need) / max }}
                  >
                    {s.need}
                  </div>
                ))
              ) : (
                <span className="text-muted-foreground absolute inset-0 grid place-items-center text-xs">休業</span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
