"use client";

import Link from "next/link";
import { Activity, ChevronRight, Clock, Radio, Trophy, Users } from "lucide-react";
import type { BolaoDefinitionCatalogItem } from "@/lib/boloes/definitions/types";
import { extraBolaoIconSrc, type ExtraBolaoIconVariant } from "@/app/shared/extra-bolao-icons";

const GREEN = "#B1EB0B";

/** Rótulo de rodada/fase — usa roundNumber quando existir, senão cai para subtitle/datesLabel. */
function phaseLabel(item: BolaoDefinitionCatalogItem): string | null {
  if (item.roundNumber != null) return `${item.roundNumber}ª Rodada`;
  return item.subtitle?.trim() || item.datesLabel || null;
}

function statusBadge(status: BolaoDefinitionCatalogItem["lifecycleStatus"]): {
  label: string;
  className: string;
  live?: boolean;
} {
  switch (status) {
    case "programado":
      return { label: "Em breve", className: "bg-primary/15 text-primary" };
    case "aberto":
      return { label: "Aberto", className: "bg-primary/15 text-primary" };
    case "ao_vivo":
      return { label: "Ao vivo", className: "bg-red-500/15 text-red-300", live: true };
    default:
      return { label: "Encerrado", className: "bg-white/8 text-white/50" };
  }
}

function StatBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <Icon className="mx-auto size-4 text-white/40" strokeWidth={2} aria-hidden />
      <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 truncate text-[14px] font-black text-white">{value}</p>
    </div>
  );
}

/**
 * Card padrão de bolão (motor v2) — usado em qualquer lista/carrossel de
 * bolões, seja qual for o status (em breve, aberto, ao vivo, encerrado).
 * O selo e o botão se adaptam ao status real do item.
 */
export function UpcomingBolaoCard({
  item,
  className = "",
}: {
  item: BolaoDefinitionCatalogItem;
  className?: string;
}) {
  const logoSrc =
    item.resolvedLogoUrl ??
    extraBolaoIconSrc((item.resolvedIconVariant || "generic") as ExtraBolaoIconVariant).src;
  const phase = phaseLabel(item);
  const prizeText = item.estimatedPrizeLabel ?? "A definir";
  const href = `/tickets?definitionId=${encodeURIComponent(item.id)}`;
  const badge = statusBadge(item.lifecycleStatus);

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-[16px] border border-white/8 bg-[#0d0d0d] ${className}`}
    >
      <div className="flex justify-center pt-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${badge.className}`}
        >
          {badge.live ? (
            <Radio className="size-3 animate-pulse" strokeWidth={2.5} aria-hidden />
          ) : (
            <Clock className="size-3" strokeWidth={2.5} aria-hidden />
          )}
          {badge.label}
        </span>
      </div>

      <div className="flex flex-col items-center px-4 pt-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" className="h-14 w-auto max-w-[88px] object-contain" draggable={false} />
        <h3 className="mt-2.5 text-center text-[16px] font-black uppercase leading-tight text-white">
          {item.displayName}
        </h3>
        {phase ? (
          <p className="mt-0.5 text-center text-[12px] font-bold" style={{ color: GREEN }}>
            {phase}
          </p>
        ) : null}
      </div>

      <div className="mt-3.5 flex items-start gap-2 border-t border-white/6 px-3 py-3">
        <StatBlock icon={Users} label="Participantes" value={item.participantCount.toLocaleString("pt-BR")} />
        <StatBlock icon={Trophy} label="Premiação" value={prizeText} />
        <StatBlock icon={Activity} label="Partidas" value={`${item.matchCount} jogos`} />
      </div>

      <div className="mx-3 mb-3 rounded-[12px] border border-white/6 bg-black/30 px-3 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Premiação estimada</p>
        <p className="mt-1 text-[22px] font-black leading-none text-primary">{prizeText}</p>
        {item.estimatedPrizeLabel ? <p className="mt-1 text-[10px] font-semibold text-white/40">NO PIX</p> : null}

        {item.purchaseOpen ? (
          <Link
            href={href}
            className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-primary text-[13px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
          >
            Quero participar
            <ChevronRight className="size-4" strokeWidth={2.6} aria-hidden />
          </Link>
        ) : (
          <Link
            href={href}
            className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] border border-white/12 bg-white/[0.04] text-[13px] font-black uppercase tracking-wide text-white/70 transition active:scale-[0.98]"
          >
            Ver classificação
            <ChevronRight className="size-4" strokeWidth={2.6} aria-hidden />
          </Link>
        )}
      </div>
    </article>
  );
}
