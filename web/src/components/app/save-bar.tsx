"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 保存後に「保存しました」を2秒だけ出すためのフック */
export function useSavedFlash(): [boolean, () => void] {
  const [show, setShow] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);
  const flash = React.useCallback(() => {
    setShow(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), 2000);
  }, []);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  return [show, flash];
}

/** フォーム下部の保存ボタン */
export function SaveBar({ dirty, saved, onReset }: { dirty: boolean; saved: boolean; onReset?: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t pt-4">
      {saved && !dirty && (
        <span className="text-ok flex items-center gap-1 text-sm" role="status">
          <Check className="size-4" />
          保存しました
        </span>
      )}
      {dirty && <span className="text-muted-foreground text-sm">変更があります</span>}
      {onReset && dirty && (
        <Button type="button" variant="ghost" onClick={onReset}>
          元に戻す
        </Button>
      )}
      <Button type="submit" disabled={!dirty}>
        保存
      </Button>
    </div>
  );
}
