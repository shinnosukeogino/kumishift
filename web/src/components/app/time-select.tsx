"use client";

import * as React from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hm } from "@/lib/dates";
import { cn } from "@/lib/utils";

const NONE = "__none__";

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** 何分ごとの選択肢にするか */
  step?: number;
  /** 「指定なし」を選べるようにする（値は空文字） */
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  id?: string;
};

/** 時刻の選択（24時間表記・区切りに合わせた選択肢）。ブラウザの言語で AM/PM 表示にならないようにする */
export const TimeSelect = React.forwardRef<HTMLButtonElement, Props>(function TimeSelect(
  { value, onChange, step = 60, allowEmpty, emptyLabel = "指定なし", className, ...aria },
  ref,
) {
  const options = React.useMemo(() => {
    const list: string[] = [];
    for (let m = 0; m < 24 * 60; m += step) list.push(hm(m));
    // 区切りに合わない値が保存されていても表示できるように残す
    if (value && !list.includes(value)) list.push(value);
    return list.sort();
  }, [step, value]);

  return (
    <Select value={value || (allowEmpty ? NONE : undefined)} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger ref={ref} className={cn("w-28 tabular-nums", className)} {...aria}>
        <SelectValue placeholder="--:--" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {allowEmpty && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
        {options.map((t) => (
          <SelectItem key={t} value={t} className="tabular-nums">
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
