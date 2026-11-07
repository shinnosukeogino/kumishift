"use client";

import * as React from "react";

import { useHydrated } from "@/lib/store";

/** 保存データの読み込みが終わるまで、子要素の代わりに読み込み中の表示を出す */
export function Hydrated({ children }: { children: React.ReactNode }) {
  const ok = useHydrated();
  if (!ok) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
        <div className="bg-muted h-64 animate-pulse rounded-xl" />
      </div>
    );
  }
  return <>{children}</>;
}
