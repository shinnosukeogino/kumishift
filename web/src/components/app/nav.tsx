"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck2, CalendarDays, ClipboardPen, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAppStore, useHydrated } from "@/lib/store";

const items = [
  { href: "/", label: "シフト表", icon: CalendarDays },
  { href: "/requests", label: "シフト入力", icon: ClipboardPen },
  { href: "/settings", label: "設定", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();
  const storeName = useAppStore((s) => s.profile.storeName);
  const hydrated = useHydrated();
  return (
    <header className="bg-card/80 no-print sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
            <CalendarCheck2 className="size-4" />
          </span>
          <span>kumishift</span>
          {hydrated && <span className="text-muted-foreground hidden text-sm font-normal sm:inline">{storeName}</span>}
        </Link>
        <nav className="ml-auto flex gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
