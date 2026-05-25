import Image from "next/image";
import { CalendarDays, Sparkles, Trophy } from "lucide-react";
import iconBrasileirao from "@/app/assets/icon-brasileirao.png";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import iconCopaMundo from "@/app/assets/icon-copa-mundo.png";
import iconPremierLeague from "@/app/assets/icon-premier-league.png";
import iconLibertadores from "@/app/assets/icone-libertadores.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import type { ExtraBolaoHeroSideVariant } from "@/lib/boloes-extra-competition-branding";

export type AdminBolaoKind = "principal" | "daily" | "extra";

export function AdminBolaoKindIcon({
  kind,
  extraVariant,
  size = "md",
}: {
  kind: AdminBolaoKind;
  extraVariant?: ExtraBolaoHeroSideVariant;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "lg"
      ? "size-[72px] rounded-2xl"
      : size === "sm"
        ? "size-12 rounded-xl"
        : "size-14 rounded-[14px]";
  const img =
    size === "lg" ? 52 : size === "sm" ? 32 : 40;

  if (kind === "principal") {
    return (
      <div className={`${box} flex shrink-0 items-center justify-center border border-white/10 bg-white/5 p-1.5`}>
        <Image src={iconCopaMundo} alt="" width={img} height={img} className="object-contain" />
      </div>
    );
  }

  if (kind === "daily") {
    return (
      <div
        className={`${box} flex shrink-0 items-center justify-center border border-primary/25 bg-primary/10`}
        aria-hidden
      >
        <CalendarDays className="size-7 text-primary" strokeWidth={2.1} />
      </div>
    );
  }

  const src =
    extraVariant === "copa_brasil"
      ? iconCopaBrasil
      : extraVariant === "brasileirao"
        ? iconBrasileirao
        : extraVariant === "premier_league"
          ? iconPremierLeague
          : extraVariant === "libertadores"
            ? iconLibertadores
            : null;

  if (src) {
    return (
      <div className={`${box} flex shrink-0 items-center justify-center border border-white/10 bg-white/5 p-1.5`}>
        <Image src={src} alt="" width={img} height={img} className="object-contain" />
      </div>
    );
  }

  return (
    <div className={`${box} flex shrink-0 items-center justify-center border border-amber-400/25 bg-amber-400/10`}>
      <Image src={ticketBlue} alt="" width={img} height={img} className="object-contain" />
    </div>
  );
}

export function AdminBolaoKindBadge({ kind }: { kind: AdminBolaoKind }) {
  const label =
    kind === "principal" ? "Principal" : kind === "daily" ? "Diário" : "Extra";
  const Icon = kind === "principal" ? Trophy : kind === "daily" ? CalendarDays : Sparkles;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary">
      <Icon className="size-3" strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}
