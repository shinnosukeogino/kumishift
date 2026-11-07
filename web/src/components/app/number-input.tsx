"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  /** 空欄を許すか（許さないときは空欄を NaN にして Zod のエラーを出す） */
  nullable?: boolean;
  suffix?: string;
};

/** 数値入力。空欄は null（制限なし）として扱う。React Hook Form の field と一緒に使う */
export function NumberInput({ value, onChange, nullable = true, suffix, className, ...props }: Props) {
  const input = (
    <Input
      type="number"
      inputMode="decimal"
      value={value == null || Number.isNaN(value) ? "" : value}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") onChange(nullable ? null : Number.NaN);
        else onChange(Number(raw));
      }}
      className={className}
      {...props}
    />
  );
  if (!suffix) return input;
  return (
    <div className="flex items-center gap-2">
      {input}
      <span className="text-muted-foreground shrink-0 text-sm">{suffix}</span>
    </div>
  );
}
