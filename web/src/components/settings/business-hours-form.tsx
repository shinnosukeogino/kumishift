"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SaveBar, useSavedFlash } from "@/components/app/save-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { TimeSelect } from "@/components/app/time-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { breakRange, businessHoursSchema, openRange, WEEKDAYS, type BusinessHours } from "@/lib/schema";
import { hm } from "@/lib/dates";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function BusinessHoursForm() {
  const value = useAppStore((s) => s.businessHours);
  const setValue = useAppStore((s) => s.setBusinessHours);
  const [saved, flash] = useSavedFlash();
  const form = useForm<BusinessHours>({ resolver: zodResolver(businessHoursSchema), defaultValues: value });
  const days = useWatch({ control: form.control, name: "days" });
  const step = useWatch({ control: form.control, name: "stepMinutes" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>営業時間</CardTitle>
        <CardDescription>
          勤務は必ず営業時間の中で組みます。「中休み」はお昼のあとなどにお店を閉める時間で、その時間をまたぐ勤務は作りません（中休みの前か後に入ります）。閉店が開店より早いときは日をまたぐ営業（例: 18:00〜02:00）になります。
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
            <div className="divide-y rounded-lg border">
              {WEEKDAYS.map((w, i) => {
                const closed = days?.[i]?.closed;
                const d = days?.[i];
                let hours: number | null = null;
                if (d && !d.closed && d.open && d.close) {
                  const [o, c] = openRange(d.open, d.close);
                  hours = c - o;
                  if (d.breakFrom && d.breakTo) {
                    const [f, t] = breakRange(d.open, d.breakFrom, d.breakTo);
                    hours -= t - f;
                  }
                  hours /= 60;
                }
                const hasBreak = !!(d?.breakFrom || d?.breakTo);
                const addBreak = () => {
                  // 営業時間のまん中あたりに2時間の中休みを入れる（あとで変更できる）
                  const [o, c] = openRange(d.open, d.close);
                  const mid = Math.floor((o + c) / 2 / step) * step;
                  const from = Math.max(o + step, mid - 60 - ((mid - 60) % step));
                  const to = Math.min(c - step, from + 120);
                  form.setValue(`days.${i}.breakFrom`, hm(from), { shouldDirty: true });
                  form.setValue(`days.${i}.breakTo`, hm(to), { shouldDirty: true, shouldValidate: true });
                };
                const removeBreak = () => {
                  form.setValue(`days.${i}.breakFrom`, "", { shouldDirty: true });
                  form.setValue(`days.${i}.breakTo`, "", { shouldDirty: true, shouldValidate: true });
                };
                return (
                  <div key={w} className={cn("grid grid-cols-[3rem_auto_1fr] items-start gap-4 px-4 py-3", closed && "bg-muted/50")}>
                    <span className={cn("pt-2 font-semibold", i === 5 && "text-blue-600", i === 6 && "text-red-600")}>{w}</span>
                    <FormField
                      control={form.control}
                      name={`days.${i}.closed`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 pt-1.5">
                          <FormControl>
                            <Switch checked={!field.value} onCheckedChange={(on) => field.onChange(!on)} aria-label={`${w}曜日の営業`} />
                          </FormControl>
                          <FormLabel className="w-12 font-normal">{field.value ? "定休日" : "営業"}</FormLabel>
                        </FormItem>
                      )}
                    />
                    {closed ? (
                      <span className="text-muted-foreground pt-2 text-sm">お休み</span>
                    ) : (
                      <div className="flex flex-wrap items-start gap-2">
                        <FormField
                          control={form.control}
                          name={`days.${i}.open`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <TimeSelect step={step} aria-label={`${w}曜日の開店`} value={field.value} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <span className="pt-2">〜</span>
                        <FormField
                          control={form.control}
                          name={`days.${i}.close`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <TimeSelect step={step} aria-label={`${w}曜日の閉店`} value={field.value} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {hasBreak ? (
                          <div className="bg-muted/60 flex items-start gap-2 rounded-md py-0 pr-1 pl-3">
                            <span className="text-muted-foreground pt-2 text-sm whitespace-nowrap">中休み</span>
                            <FormField
                              control={form.control}
                              name={`days.${i}.breakFrom`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <TimeSelect step={step} aria-label={`${w}曜日の中休みの始まり`} value={field.value} onChange={field.onChange} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <span className="pt-2">〜</span>
                            <FormField
                              control={form.control}
                              name={`days.${i}.breakTo`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <TimeSelect step={step} aria-label={`${w}曜日の中休みの終わり`} value={field.value} onChange={field.onChange} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button type="button" variant="ghost" size="icon" aria-label={`${w}曜日の中休みを消す`} onClick={removeBreak}>
                              <X className="text-muted-foreground" />
                            </Button>
                          </div>
                        ) : (
                          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground mt-0.5" onClick={addBreak}>
                            <Plus />
                            中休み
                          </Button>
                        )}
                        {hours != null && <span className="text-muted-foreground pt-2 text-sm whitespace-nowrap">営業 {hours}時間</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {form.formState.errors.days?.root?.message || form.formState.errors.days?.message ? (
              <p className="text-destructive text-sm">{form.formState.errors.days?.message ?? form.formState.errors.days?.root?.message}</p>
            ) : null}

            <div className="grid items-start gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="holidayMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>祝日の営業</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sunday">日曜と同じ営業時間</SelectItem>
                        <SelectItem value="weekday">その曜日の営業時間</SelectItem>
                        <SelectItem value="closed">休業</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>祝日の日付は「祝日・休業日」タブで管理します。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stepMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>時間の区切り</FormLabel>
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl>
                        <SelectTrigger className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="60">1時間ごと（おすすめ）</SelectItem>
                        <SelectItem value="30">30分ごと</SelectItem>
                        <SelectItem value="15">15分ごと</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>細かくすると、計算に時間がかかります。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <SaveBar dirty={form.formState.isDirty} saved={saved} onReset={() => form.reset(value)} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
