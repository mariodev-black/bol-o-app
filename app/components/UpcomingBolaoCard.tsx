"use client";

import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  Radio,
  Trophy,
  Users,
} from "lucide-react";
import type { BolaoDefinitionCatalogItem } from "@/lib/boloes/definitions/types";
import { isClosedBolaoStatus } from "@/lib/boloes/definitions/lifecycle-labels";
import { formatBrlFromCents, formatPositionOrdinal } from "@/lib/boloes/format-prize-brl";
import { extraBolaoIconSrc, type ExtraBolaoIconVariant } from "@/app/shared/extra-bolao-icons";

const GREEN = "#B1EB0B";
const CARD_BG = "#101010";
const CARD_BAR = "#1B1B1B";
const CARD_BORDER = "rgba(255,255,255,0.08)";

export type UpcomingBolaoCardUserStats = {
  position: number | null;
  points?: number;
  prizeReceivedCents: number;
};

/** Rótulo de rodada/fase — usa roundNumber quando existir, senão cai para subtitle/datesLabel. */
function phaseLabel(item: BolaoDefinitionCatalogItem): string | null {
  if (item.roundNumber != null) return `${item.roundNumber}ª Rodada`;
  return item.subtitle?.trim() || item.datesLabel || null;
}

function statusBadge(
  status: BolaoDefinitionCatalogItem["lifecycleStatus"],
  owned: boolean,
): {
  label: string;
  tone: string;
  icon: typeof Clock;
  live?: boolean;
} {
  if (owned && !isClosedBolaoStatus(status)) {
    return { label: "Em andamento", tone: "rgba(255,255,255,0.92)", icon: Radio, live: true };
  }
  if (isClosedBolaoStatus(status)) {
    return {
      label: "Encerrado",
      tone: "rgba(255,255,255,0.62)",
      icon: CheckCircle2,
    };
  }
  switch (status) {
    case "programado":
      return { label: "Em breve", tone: "rgba(255,255,255,0.92)", icon: Clock };
    case "aberto":
      return { label: "Aberto", tone: GREEN, icon: CheckCircle2 };
    case "ao_vivo":
      return { label: "Ao vivo", tone: "#FCA5A5", icon: Radio, live: true };
    default:
      return { label: "Encerrado", tone: "rgba(255,255,255,0.62)", icon: CheckCircle2 };
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
    <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
      <Icon className="size-[21px] shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
      <div className="min-w-0 text-left">
        <p className="truncate text-[8.5px] font-black uppercase leading-none tracking-[0.09em] text-white/78">
          {label}
        </p>
        <p className="mt-1 truncate text-[13px] font-black leading-none text-primary">
          {value}
        </p>
      </div>
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
  userStats,
  resultHref,
  href: hrefOverride,
}: {
  item: BolaoDefinitionCatalogItem;
  className?: string;
  userStats?: UpcomingBolaoCardUserStats;
  /** Link do botão de resultado/classificação (ex.: palpites da cota). */
  resultHref?: string;
  /** Link explícito do CTA quando o item não é uma definição dinâmica. */
  href?: string;
}) {
  const logoSrc =
    item.resolvedLogoUrl ??
    extraBolaoIconSrc((item.resolvedIconVariant || "generic") as ExtraBolaoIconVariant).src;
  const phase = phaseLabel(item);
  const prizeText = item.estimatedPrizeLabel ?? "A definir";
  const defaultHref = `/tickets?definitionId=${encodeURIComponent(item.id)}`;
  const href = hrefOverride ?? resultHref ?? defaultHref;
  const owned = userStats?.points != null && !isClosedBolaoStatus(item.lifecycleStatus);
  const badge = statusBadge(item.lifecycleStatus, owned);
  const StatusIcon = badge.icon;
  const closed = isClosedBolaoStatus(item.lifecycleStatus);
  const positionLabel = formatPositionOrdinal(userStats?.position);
  const pointsLabel = `${userStats?.points ?? 0}`;
  const prizeReceivedLabel = formatBrlFromCents(userStats?.prizeReceivedCents ?? 0);
  const ctaLabel = closed ? "Ver resultado" : owned ? "Ver classificação" : "Quero participar";
  const ctaClass = closed
    ? "border border-white/12 bg-white/[0.04] text-white/72"
    : "bg-primary text-[#0E141B]";

  return (
    <article
      className={`flex min-h-[302px] flex-col overflow-hidden rounded-[7px] border shadow-[0_18px_50px_rgba(0,0,0,0.45)] ${className}`}
      style={{ background: CARD_BG, borderColor: CARD_BORDER }}
    >
      <div
        className="flex h-[27px] w-full items-center justify-center gap-1.5 text-[12px] font-black uppercase tracking-[0.08em]"
        style={{ background: CARD_BAR, color: badge.tone }}
      >
        <StatusIcon
          className={`size-3 ${badge.live ? "animate-pulse" : ""}`}
          strokeWidth={2.6}
          aria-hidden
        />
        {badge.label}
      </div>

      <div className="flex flex-col items-center px-4 pt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt=""
          className="h-[70px] w-auto max-w-[100px] object-contain"
          draggable={false}
        />
        <h3 className="mt-2  text-center text-[15px] font-black uppercase leading-[1.12] tracking-[-0.01em] text-white">
          {item.displayName}
        </h3>
        {phase ? (
          <p className="mt-2 rounded-full bg-white/6 px-3 py-1 text-center text-[10px] font-black uppercase tracking-[0.05em] text-white/74">
            {phase}
          </p>
        ) : null}
      </div>

      <div
        className="mx-3 mt-2 flex items-center gap-2 border-y px-2.5 py-3"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        {closed ? (
          <>
            <StatBlock icon={Trophy} label="Sua posição" value={positionLabel} />
            <StatBlock icon={Users} label="Prêmio" value={prizeReceivedLabel} />
          </>
        ) : owned ? (
          <>
            <StatBlock icon={Users} label="Sua posição" value={positionLabel} />
            <StatBlock icon={Activity} label="Pontos" value={pointsLabel} />
          </>
        ) : (
          <>
            <StatBlock
              icon={Users}
              label="Participantes"
              value={item.participantCount.toLocaleString("pt-BR")}
            />
            <StatBlock icon={Activity} label="Partidas" value={`${item.matchCount} jogos`} />
          </>
        )}
      </div>

      <div className="mt-auto px-3 pb-3 pt-4 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-white/52">
          {closed ? "Prêmio recebido" : owned ? "Prêmio estimado" : "Prêmio garantido"}
        </p>
        <p className="mt-1.5 text-[24px] font-black leading-none tracking-[-0.02em] text-primary">
          {closed ? prizeReceivedLabel : prizeText}
        </p>

        <Link
          href={href}
          className={`mt-2 flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[6px] text-[13px] font-black uppercase tracking-[0.02em] transition active:scale-[0.98] ${ctaClass}`}
        >
          {ctaLabel}
          <ChevronRight className="size-3.5" strokeWidth={2.8} aria-hidden />
        </Link>
      </div>
    </article>
  );
}
