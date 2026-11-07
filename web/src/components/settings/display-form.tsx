"use client";

import * as React from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, RotateCcw, Trash2 } from "lucide-react";

import { SaveBar, useSavedFlash } from "@/components/app/save-bar";
import { TimeSelect } from "@/components/app/time-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { bandOf } from "@/lib/bands";
import { PALETTE, PALETTE_IDS, type PaletteId } from "@/lib/palette";
import { displaySchema, toMinutes, type Display } from "@/lib/schema";
import { DEFAULT_DISPLAY, useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** 時間帯の色（勤務の始まる時刻で色を分ける） */
export function DisplayForm() {
  const value = useAppStore((s) => s.display);
  const setValue = useAppStore((s) => s.setDisplay);
  const [saved, flash] = useSavedFlash();
  const form = useForm<Display>({ resolver: zodResolver(displaySchema), defaultValues: value });
  const bands = useFieldArray({ control: form.control, name: "bands" });
  const watched = useWatch({ control: form.control, name: "bands" }) ?? [];
  const valid = watched.filter((b) => b?.from && b?.label && b?.color);

  // プレビュー用の勤務の例
  const samples = [9 * 60, 11 * 60, 13 * 60, 16 * 60, 18 * 60, 22 * 60];

  return (
    <Card>
      <CardHeader>
        <CardTitle>時間帯の色</CardTitle>
        <CardDescription>
          シフト表と印刷の色は、勤務が始まる時刻で決まります。「この時刻から」の時刻以降に始まる勤務がその色になります。
          いちばん早い時刻より前に始まる勤務（深夜など）は、いちばん最後の時間帯の色になります。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit((v) => {
              const sorted = { bands: [...v.bands].sort((a, b) => toMinutes(a.from) - toMinutes(b.from)) };
              setValue(sorted);
              form.reset(sorted);
              flash();
            })}
          >
            <div className="space-y-3">
              <div className="text-muted-foreground hidden grid-cols-[8rem_9rem_1fr_2.25rem] gap-3 px-1 text-xs md:grid">
                <span>この時刻から</span>
                <span>名前</span>
                <span>色</span>
              </div>
              {bands.fields.map((f, i) => (
                <div key={f.id} className="grid items-start gap-3 rounded-lg border p-3 md:grid-cols-[8rem_9rem_1fr_2.25rem] md:border-0 md:p-0">
                  <FormField
                    control={form.control}
                    name={`bands.${i}.from`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <TimeSelect step={30} className="w-full" aria-label="この時刻から" value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`bands.${i}.label`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input aria-label="時間帯の名前" placeholder="例: 朝" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`bands.${i}.color`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <ColorPicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="この時間帯を消す"
                    disabled={bands.fields.length <= 1}
                    onClick={() => bands.remove(i)}
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {form.formState.errors.bands?.root?.message && (
                <p className="text-destructive text-sm">{form.formState.errors.bands.root.message}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {bands.fields.length < 6 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => bands.append({ from: "18:00", label: "", color: "pink" })}
                  >
                    <Plus />
                    時間帯を追加
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => form.reset(DEFAULT_DISPLAY, { keepDefaultValues: true })}>
                  <RotateCcw />
                  はじめの色に戻す
                </Button>
              </div>
            </div>

            {valid.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">プレビュー（保存前の内容も反映されます）</p>
                <div className="flex flex-wrap gap-2">
                  {samples.map((t) => {
                    const b = bandOf(valid, t);
                    return (
                      <span key={t} className={cn("rounded px-2 py-1 text-xs font-semibold tabular-nums", b.solid)}>
                        {t / 60}時から → {b.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <SaveBar dirty={form.formState.isDirty} saved={saved} onReset={() => form.reset(value)} />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/** 色の選択（丸い見本を並べる） */
const ColorPicker = React.forwardRef<HTMLDivElement, { value: PaletteId; onChange: (v: PaletteId) => void }>(function ColorPicker(
  { value, onChange },
  ref,
) {
  return (
    <div ref={ref} role="radiogroup" aria-label="色" className="flex flex-wrap gap-1.5 pt-0.5">
      {PALETTE_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={PALETTE[id].label}
          title={PALETTE[id].label}
          onClick={() => onChange(id)}
          className={cn(
            "focus-visible:ring-ring/50 size-8 rounded-full outline-none hover:opacity-80 focus-visible:ring-[3px]",
            PALETTE[id].dot,
            value === id && "ring-foreground ring-2 ring-offset-2",
          )}
        />
      ))}
    </div>
  );
});
