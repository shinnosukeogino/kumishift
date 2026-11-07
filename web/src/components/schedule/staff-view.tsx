import type { ViewData } from "@/lib/types";

export function StaffView({ data }: { data: ViewData }) {
  const max = Math.max(1, ...data.staff.map((s) => s.hours));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {data.staff.map((s) => (
        <div key={s.name} className="rounded-lg border p-4">
          <div className="mb-2 font-semibold">{s.name}</div>
          <div className="text-muted-foreground grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-foreground text-lg font-bold tabular-nums">{s.days}</div>出勤日
            </div>
            <div>
              <div className="text-foreground text-lg font-bold tabular-nums">{+s.hours.toFixed(1)}</div>時間
            </div>
            <div>
              <div className="text-foreground text-lg font-bold tabular-nums">{s.weekend}</div>土日祝
            </div>
          </div>
          <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
            <div className="bg-primary h-full rounded-full" style={{ width: `${(s.hours / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
