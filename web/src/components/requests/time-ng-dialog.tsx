"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { TimeSelect } from "@/components/app/time-select";
import { dayLabel, weekdayLabel } from "@/lib/dates";
import { shiftRequestSchema, type ShiftRequest } from "@/lib/schema";
import { useAppStore } from "@/lib/store";

export function TimeNgDialog({
  target,
  onClose,
}: {
  target: { staffId: string; staffName: string; date: string; from?: string; to?: string } | null;
  onClose: () => void;
}) {
  const setRequest = useAppStore((s) => s.setRequest);
  const step = useAppStore((s) => s.businessHours.stepMinutes);
  const form = useForm<ShiftRequest>({
    resolver: zodResolver(shiftRequestSchema),
    defaultValues: { staffId: "", date: "", type: "ngTime", from: "", to: "" },
  });

  React.useEffect(() => {
    if (target) {
      form.reset({
        staffId: target.staffId,
        date: target.date,
        type: "ngTime",
        from: target.from ?? "17:00",
        to: target.to ?? "21:00",
      });
    }
  }, [target, form]);

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>入れない時間を指定</DialogTitle>
          <DialogDescription>
            {target && `${target.staffName} さん・${dayLabel(target.date)}(${weekdayLabel(target.date)})`}
            。この時間にかかる勤務には入れません。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => {
              setRequest(v);
              onClose();
            })}
          >
            <div className="flex items-start gap-2">
              <FormField
                control={form.control}
                name="from"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>から</FormLabel>
                    <FormControl>
                      <TimeSelect step={step} className="w-full" value={field.value} onChange={field.onChange} />
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
                      <TimeSelect step={step} className="w-full" value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                キャンセル
              </Button>
              <Button type="submit">登録</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
