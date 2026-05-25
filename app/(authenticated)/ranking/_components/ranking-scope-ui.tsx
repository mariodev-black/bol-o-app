"use client";

import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Flag,
  Sparkles,
  Trophy,
} from "lucide-react";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import iconBrasileirao from "@/app/assets/icon-brasileirao.png";
import iconCopaMundo from "@/app/assets/icon-copa-mundo.png";
import iconPremierLeague from "@/app/assets/icon-premier-league.png";
import iconLibertadores from "@/app/assets/icone-libertadores.png";
import { getExtraBolaoHeroSideVariant } from "@/lib/boloes-extra-competition-branding";
import type {
  RankingScopeOption,
  RankingScopeStatus,
} from "@/lib/ranking/scopes-shared";

export const RANKING_GREEN = "#B1EB0B";
export const RANKING_YELLOW = "#E6B726";
/** Indicador “ao vivo” (alinhado ao Palpites). */
export const RANKING_LIVE_RED = "#E53935";
export const RANKING_INK = "#0E141B";
export const RANKING_CARD_BG = "#111111";
export const RANKING_BORDER = "rgba(255,255,255,0.06)";

export function formatPendingGamesLine(count: number): string {
  const n = Math.max(0, Math.round(count));
  if (n === 0) return "";
  if (n === 1) return "Falta 1 jogo para você palpitar";
  return `Faltam ${n} jogos para você palpitar`;
}

/** Faixa amarela do card de bolão: nenhum palpite vs jogos ainda em aberto. */
export function scopePendingBarMessage(option: {
  palpitesSentCount: number;
  pendingPalpitesCount: number;
}): string | null {
  const pending = Math.max(0, option.pendingPalpitesCount ?? 0);
  const sent = Math.max(0, option.palpitesSentCount ?? 0);
  if (pending < 1) return null;
  if (sent < 1) return "Você ainda não enviou nenhum palpite";
  return formatPendingGamesLine(pending);
}

/** @deprecated Use formatPendingGamesLine */
export function formatPendingPalpitesLine(count: number): string {
  return formatPendingGamesLine(count);
}

export function scopeRoundLabel(option: RankingScopeOption): string | null {
  const explicit = option.roundLabel?.trim();
  if (explicit) return explicit;
  if (option.mode === "principal") {
    return option.selectSecondary?.trim() || "Todas as rodadas";
  }
  const { primary } = scopeSelectLines(option);
  if (option.mode === "extra" && primary.includes(" · ")) {
    const [, rod] = primary.split(" · ", 2);
    return rod?.trim() || null;
  }
  if (option.mode === "diario") {
    const date = option.selectSecondary?.trim();
    return date ? `Jogos de ${date}` : "Rodada do dia";
  }
  return null;
}

export function scopeStatusColor(status: RankingScopeStatus): string {
  if (status === "ativa") return "#0AC96B";
  if (status === "aguardando") return RANKING_YELLOW;
  return "#F87171";
}

/** Cota sem palpites (`aguardando`); após apostar, usa o rótulo do servidor (`ativa` / `encerrado`). */
export function scopeStatusLabel(option: {
  status: RankingScopeStatus;
  statusLabel: string;
}): string {
  if (option.status === "aguardando") return "Falta enviar seu palpite";
  return option.statusLabel;
}

export function scopeStatusIcon(option: {
  status: RankingScopeStatus;
  statusLabel: string;
}): LucideIcon {
  if (option.status === "aguardando") return AlertTriangle;
  if (option.status === "encerrado") {
    return option.statusLabel.toUpperCase().includes("FINALIZADO")
      ? Flag
      : CheckCircle2;
  }
  return option.statusLabel.toUpperCase().includes("DISPUTA")
    ? Activity
    : ClipboardList;
}

export function ScopeStatusIcon({
  option,
  className = "size-4 shrink-0",
}: {
  option: { status: RankingScopeStatus; statusLabel: string };
  className?: string;
}) {
  const Icon = scopeStatusIcon(option);
  return (
    <Icon
      className={className}
      style={{ color: scopeStatusColor(option.status) }}
      strokeWidth={2.25}
      aria-hidden
    />
  );
}

export function scopeCardHeaderParts(
  option: RankingScopeOption,
  primary: string,
) {
  if (option.mode === "principal") {
    return { category: "Bolão do Milhão", title: "PRINCIPAL" };
  }
  if (option.mode === "diario") {
    return { category: "Bolão do dia", title: "DIÁRIO" };
  }
  if (primary.includes(" · ")) {
    const [cat, rod] = primary.split(" · ", 2);
    return {
      category: (cat ?? primary).trim(),
      title: (rod ?? "").trim() || primary.trim(),
    };
  }
  return { category: "Bolão extra", title: primary.trim() };
}

export function ScopeLogoLarge({ option }: { option: RankingScopeOption }) {
  const { primary } = scopeSelectLines(option);

  if (option.mode === "principal") {
    return (
      <Image
        src={iconCopaMundo}
        alt=""
        width={88}
        height={88}
        className="h-[76px] w-[68px] object-contain object-center"
      />
    );
  }

  if (option.mode === "diario") {
    return <SoccerBallIcon className="h-[72px] w-[72px]" />;
  }

  const variant = getExtraBolaoHeroSideVariant(
    option.extraChampionshipId,
    option.selectPrimary ?? primary,
  );
  const src =
    variant === "copa_brasil"
      ? iconCopaBrasil
      : variant === "brasileirao"
        ? iconBrasileirao
        : variant === "premier_league"
          ? iconPremierLeague
          : variant === "libertadores"
            ? iconLibertadores
            : null;

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={88}
        height={88}
        className="h-[76px] w-[72px] object-contain object-center"
      />
    );
  }

  return (
    <div
      className="flex size-[72px] items-center justify-center rounded-2xl"
      style={{ background: `${RANKING_GREEN}18` }}
    >
      <Sparkles className="size-10 text-primary" strokeWidth={2} aria-hidden />
    </div>
  );
}

export function SoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9.25"
        fill="#f4f4f5"
        stroke="#18181b"
        strokeWidth="0.65"
      />
      <path
        fill="#18181b"
        d="M12 6.35 14.42 8.12v3.52L12 13.65 9.58 11.64V8.12L12 6.35zm-5.9 2.78 2.95 1.05v4.64l-2.95 1.05-1.82-3.37 1.82-3.37zm11.8 0 1.82 3.37-1.82 3.37-2.95-1.05v-4.64l2.95-1.05z"
      />
    </svg>
  );
}

export function scopeGlyphForMode(
  mode: RankingScopeOption["mode"] | undefined,
  size: "lg" | "md" | "sm" = "md",
  extraSelectPrimary?: string | null,
  extraChampionshipId?: number | null,
) {
  const dim =
    size === "lg" ? "size-11" : size === "md" ? "size-[22px]" : "size-[18px]";
  const imgPx = size === "lg" ? 44 : size === "md" ? 22 : 18;
  const stroke = size === "lg" ? 2.4 : size === "sm" ? 2 : 2.2;

  if (mode === "principal")
    return (
      <Trophy
        className={`${dim} shrink-0 text-primary`}
        strokeWidth={stroke}
        aria-hidden
      />
    );
  if (mode === "extra") {
    const variant = getExtraBolaoHeroSideVariant(
      extraChampionshipId,
      extraSelectPrimary,
    );
    if (variant === "copa_brasil") {
      return (
        <Image
          src={iconCopaBrasil}
          alt=""
          width={imgPx}
          height={imgPx}
          className={`${dim} shrink-0 object-contain`}
        />
      );
    }
    if (variant === "brasileirao") {
      return (
        <Image
          src={iconBrasileirao}
          alt=""
          width={imgPx}
          height={imgPx}
          className={`${dim} shrink-0 object-contain`}
        />
      );
    }
    if (variant === "premier_league") {
      return (
        <Image
          src={iconPremierLeague}
          alt=""
          width={imgPx}
          height={imgPx}
          className={`${dim} shrink-0 object-contain`}
        />
      );
    }
    if (variant === "libertadores") {
      return (
        <Image
          src={iconLibertadores}
          alt=""
          width={imgPx}
          height={imgPx}
          className={`${dim} shrink-0 object-contain`}
        />
      );
    }
    return (
      <Sparkles
        className={`${dim} shrink-0 text-primary`}
        strokeWidth={stroke}
        aria-hidden
      />
    );
  }
  return <SoccerBallIcon className={dim} />;
}

export function scopeSelectLines(option: RankingScopeOption) {
  const primary =
    option.selectPrimary ??
    (option.label.includes(" — ")
      ? option.label.split(" — ")[0]!
      : option.label);
  const secondary =
    option.selectSecondary ??
    (option.label.includes(" — ")
      ? option.label.split(" — ").slice(1).join(" — ")
      : option.meta);
  return { primary, secondary };
}

const RANKING_SCOPE_STATUS_TONE: Record<
  RankingScopeStatus,
  { bg: string; border: string; color: string }
> = {
  ativa: {
    bg: "rgba(10,201,107,0.14)",
    border: "rgba(10,201,107,0.4)",
    color: "#0AC96B",
  },
  aguardando: {
    bg: "rgba(230,183,38,0.14)",
    border: "rgba(230,183,38,0.4)",
    color: "#E6B726",
  },
  encerrado: {
    bg: "rgba(248,113,113,0.14)",
    border: "rgba(248,113,113,0.38)",
    color: "#F87171",
  },
};

export function RankingScopeStatusPill({
  status,
  label,
  size = "sm",
}: {
  status: RankingScopeStatus;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const tone = RANKING_SCOPE_STATUS_TONE[status];
  const sizeClass =
    size === "lg"
      ? "w-fit max-w-full px-3 py-1.5 text-[13px]"
      : size === "md"
        ? "w-fit max-w-full px-2.5 py-1 text-[12px]"
        : "max-w-[9.5rem] px-2 py-0.5 text-[10px]";
  const dotClass =
    size === "lg" ? "size-2" : size === "md" ? "size-1.5" : "size-[5px]";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg border font-bold leading-snug ${sizeClass}`}
      style={{
        background: tone.bg,
        borderColor: tone.border,
        color: tone.color,
      }}
    >
      <span
        className={`rounded-full ${dotClass}`}
        style={{ background: tone.color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function formatParticipantsShort(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} mi`;
  if (n >= 1000) return `${Math.round(n / 1000)} mil`;
  return String(Math.round(n));
}

export function formatPoolBRL(cents: number): string {
  const v = Math.max(0, Math.round(cents));
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(v / 100);
}

export function formatClosingCountdown(lockMs: number | null): string {
  if (lockMs == null) return "Em breve";
  const d = lockMs - Date.now();
  if (d <= 0) return "Fechado";
  const totalM = Math.ceil(d / 60000);
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
