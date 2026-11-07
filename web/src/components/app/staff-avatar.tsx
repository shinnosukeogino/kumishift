import { STAFF_ICONS } from "@/lib/staff-icons";
import { cn } from "@/lib/utils";

/** スタッフのアイコン（選んだアイコン、なければ名前の1文字目） */
export function StaffAvatar({ name, icon, className }: { name: string; icon?: string; className?: string }) {
  const def = icon ? STAFF_ICONS[icon] : undefined;
  return (
    <span
      aria-hidden
      className={cn(
        "bg-secondary text-secondary-foreground inline-grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
        className,
      )}
    >
      {def ? <def.Icon className="size-[60%]" /> : name.slice(0, 1)}
    </span>
  );
}
