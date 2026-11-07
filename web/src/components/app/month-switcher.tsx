"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { monthLabel, shiftMonth } from "@/lib/dates";
import { useAppStore } from "@/lib/store";

export function MonthSwitcher() {
  const month = useAppStore((s) => s.month);
  const setMonth = useAppStore((s) => s.setMonth);
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon-sm" aria-label="前の月" onClick={() => setMonth(shiftMonth(month, -1))}>
        <ChevronLeft />
      </Button>
      <span className="min-w-28 text-center text-base font-semibold tabular-nums">{monthLabel(month)}</span>
      <Button variant="outline" size="icon-sm" aria-label="次の月" onClick={() => setMonth(shiftMonth(month, 1))}>
        <ChevronRight />
      </Button>
    </div>
  );
}
