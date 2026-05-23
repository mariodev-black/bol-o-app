import type { LucideIcon } from "lucide-react";

export function AdminBolaoStat({
  icon: Icon,
  label,
  value,
  accent = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent?: "primary" | "amber" | "default";
}) {
  const iconColor =
    accent === "amber" ? "text-amber-300" : accent === "primary" ? "text-primary" : "text-white/35";
  const border =
    accent === "amber"
      ? "border-amber-400/20 bg-amber-400/8"
      : accent === "primary"
        ? "border-primary/20 bg-primary/8"
        : "border-white/8 bg-black/25";

  return (
    <div className={`rounded-[12px] border px-2.5 py-3 ${border}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`size-3.5 shrink-0 ${iconColor}`} strokeWidth={2.25} aria-hidden />
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white/35">{label}</p>
      </div>
      <p className="mt-1.5 text-[17px] font-black leading-none text-white tabular-nums">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
    </div>
  );
}
