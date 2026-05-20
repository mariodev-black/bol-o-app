"use client";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Lock,
  MoveHorizontal,
  MousePointerClick,
  Shield,
  Trophy,
  Sparkles,
  Ticket,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import iconBrasileirao from "@/app/assets/icon-brasileirao.png";
import iconPremierLeague from "@/app/assets/icon-premier-league.png";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import iconCopaMundo from "@/app/assets/icon-copa-mundo.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import { getExtraBolaoHeroSideVariant } from "@/lib/boloes-extra-competition-branding";
import { extraBolaoIconSrc, isExtraBolaoBrandedIcon } from "@/app/shared/extra-bolao-icons";
import { useEffect, useMemo, useRef, useState } from "react";

export type ActivePrincipalBolao = {
  id: string;
  title: string;
  cotaLabel: string;
  href: string;
  status: "ativo";
  statusLabel: string;
  sent: number;
  total: number;
  progress: number;
  position: number | null;
  points: number;
};

export type ActiveDailyBolao = {
  id: string;
  title: string;
  cotaLabel: string;
  href: string;
  status: "ativo" | "aguardando" | "usado";
  statusLabel: string;
  gamesCount: number;
  countdownLabel: string;
  countdownTargetMs: number | null;
  position: number | null;
  points: number;
};

export type ActiveBolaoListItem = {
  id: string;
  type: "principal" | "diario" | "extra";
  /** Bolão extra: id do campeonato na API-Futebol. */
  championshipId?: number;
  title: string;
  cotaLabel: string;
  href: string;
  status: "ativo" | "aguardando" | "usado";
  statusLabel: string;
  sent?: number;
  total?: number;
  progress?: number;
  gamesCount?: number;
  countdownLabel?: string;
  countdownTargetMs?: number | null;
  position: number | null;
  points: number;
  /** Tickets distintos com palpite neste bolão (card vitrine). */
  participantCount?: number;
};

export type BoloesScreenData = {
  participantsByBolao: {
    principal: number;
    diario: number;
    extra: number;
  };
  summary: {
    activeCount: number;
    pendingPredictions: number;
    bestPosition: number | null;
  };
  active: {
    principal: ActivePrincipalBolao | null;
    diario: ActiveDailyBolao | null;
    all: ActiveBolaoListItem[];
  };
  upcoming: {
    daily: {
      href: string;
      gamesCount: number;
      closesAtMs: number | null;
      priceLabel: string;
    };
    principal: {
      href: string;
      priceLabel: string;
      closesAtMs: number | null;
    };
    extras: Array<{
      championshipId: number;
      title: string;
      href: string;
      gamesCount: number;
      closesAtMs: number | null;
      priceLabel: string;
    }>;
  };
};

const GREEN = "#B1EB0B";
const GREEN_SOFT = "#0AC96B";
const YELLOW = "#E6B726";
const CARD = "#111111";
const CARD_ALT = "#0F0F0F";
const BORDER = "rgba(255,255,255,0.06)";
const EMPTY_UPCOMING: BoloesScreenData["upcoming"] = {
  daily: {
    href: "/tickets?bolao=diario",
    gamesCount: 0,
    closesAtMs: null,
    priceLabel: "—",
  },
  principal: {
    href: "/tickets",
    priceLabel: "—",
    closesAtMs: null,
  },
  extras: [],
};
const INK = "#0E141B";
const SHOWCASE_CARD_BG = "#111111";

const SHOWCASE_PRIZES: Record<
  "principal" | "diario" | "extra",
  { total: string; first: string }
> = {
  principal: { total: "R$ 1.000.000", first: "R$ 500.000" },
  diario: { total: "R$ 10.000", first: "R$ 5.000" },
  extra: { total: "R$ 10.000", first: "R$ 5.000" },
};

/** Rótulos do header como na referência (CAMPEONATO / BRASILEIRO). */
function showcaseHeaderParts(
  displayTitle: string,
  kind: "principal" | "diario" | "extra",
): { category: string; title: string } {
  const t = displayTitle.trim();
  const lower = t.toLowerCase();
  if (kind === "principal") {
    return { category: "Bolão do Milhão", title: "PRINCIPAL" };
  }
  if (kind === "diario") {
    return { category: "Bolão do dia", title: "DIÁRIO" };
  }
  if (kind === "extra" && t.includes(" · ")) {
    const [cat, rod] = t.split(" · ", 2);
    return { category: cat.trim() || "Campeonato", title: (rod ?? "Rodada").trim() };
  }
  if (lower.includes("brasileir")) {
    return { category: "Campeonato", title: "Brasileiro" };
  }
  if (lower.includes("premier")) {
    return { category: "Campeonato", title: "Premier League" };
  }
  if (lower.includes("copa") && lower.includes("brasil") && !lower.includes("mundo")) {
    return { category: "Campeonato", title: "Copa do Brasil" };
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return {
      category: words.slice(0, -1).join(" "),
      title: words[words.length - 1]!,
    };
  }
  return { category: "Campeonato", title: t || "Extra" };
}

/**
 * Hook de relógio para countdowns. O valor inicial é `0` (sentinel "ainda não
 * hidratou") em vez de `Date.now()` — isso é fundamental para evitar hydration
 * mismatch: o SSR e o primeiro render do client produzem o MESMO HTML
 * (`--:--:--`), e só depois do mount o relógio entra em ação.
 *
 * Consumidores devem tratar `now === 0` como "placeholder" — `formatCountdown`
 * e `lockHasPassed` abaixo fazem isso. Outros consumers que comparem `now`
 * diretamente precisam considerar esse contrato.
 */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return now;
}

function formatCountdown(targetMs: number | null, now: number): string {
  // `now === 0` ⇒ ainda não hidratou (SSR / primeiro render).
  if (!targetMs || !now) return "--:--:--";
  const seconds = Math.max(0, Math.floor((targetMs - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/** Prazo de palpite / fechamento já ocorreu (ex.: jogo já aconteceu). */
function lockHasPassed(targetMs: number | null, now: number): boolean {
  // Antes da hidratação assumimos "ainda não passou" (default seguro: mostra
  // ainda "Fazer palpites" em vez de "Ver resultados" por um piscar).
  if (!now) return false;
  return targetMs != null && now >= targetMs;
}

function positionLabel(position: number | null) {
  return position == null ? "--" : `#${position}`;
}

function pointsLabel(points: number) {
  return `${points} pts`;
}

/** Ativo / aguardando primeiro; usado por último (mesmo id estável como desempate). */
function sortBoloesByAvailabilityForShowcase(
  items: ActiveBolaoListItem[],
): ActiveBolaoListItem[] {
  const rank = (s: ActiveBolaoListItem["status"]) =>
    s === "ativo" ? 0 : s === "aguardando" ? 1 : 2;
  return [...items].sort((a, b) => {
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = GREEN,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <div
      className="flex h-[121px] flex-1 flex-col items-center justify-center rounded-[13px] border px-2 text-center transition-transform active:scale-[0.98]"
      style={{ background: CARD, borderColor: BORDER }}
    >
      <div
        className="mb-3 flex size-[25px] items-center justify-center rounded-[7px] border"
        style={{
          background: `${tone}18`,
          borderColor: `${tone}22`,
        }}
        aria-hidden
      >
        <Icon
          className="size-[13px]"
          style={{ color: tone }}
          strokeWidth={2.1}
        />
      </div>
      <p className="whitespace-pre-line text-[9px] font-black uppercase leading-[1.12] tracking-[0.08em] text-white/82 min-[380px]:text-[12px]">
        {label}
      </p>
      <p
        className="mt-1 text-[24px] font-black leading-none tracking-[-0.03em]"
        style={{ color: tone }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[12px] font-medium leading-none text-white/55">
        {helper}
      </p>
    </div>
  );
}

function SectionTitle({
  title,
  href,
  onClick,
  expanded,
}: {
  title: string;
  href: string;
  onClick?: () => void;
  expanded?: boolean;
}) {
  const content = (
    <>
      {expanded ? "Ocultar" : "Ver todos"}{" "}
      <ChevronRight
        className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`}
        strokeWidth={2.6}
      />
    </>
  );

  return (
    <div className="mb-[26px] flex items-center justify-between">
      <h2 className="text-[17px] font-black leading-none tracking-[-0.03em] text-white">
        {title}
      </h2>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] font-bold leading-none transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
          style={{ color: GREEN }}
          aria-expanded={expanded}
        >
          {content}
        </button>
      ) : (
        <Link
          href={href}
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] font-bold leading-none transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
          style={{ color: GREEN }}
        >
          {content}
        </Link>
      )}
    </div>
  );
}

function ActiveRowBolaoIcon({
  isPrincipal,
  isExtra,
  title,
  championshipId,
}: {
  isPrincipal: boolean;
  isExtra: boolean;
  title: string;
  championshipId?: number | null;
}) {
  if (isPrincipal) {
    return (
      <div className="flex w-[58px] shrink-0 flex-col items-center justify-center px-0.5 text-center">
        <Image
          src={iconCopaMundo}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
        />
        <p className="mt-1 whitespace-pre-line text-[8px] font-black uppercase leading-[0.96] text-primary">
          {"FIFA\nWorld Cup"}
        </p>
      </div>
    );
  }
  if (!isExtra) {
    return (
      <div className="flex w-[58px] shrink-0 flex-col items-center justify-center px-0.5 text-center">
        <Image
          src={iconCopaMundo}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
        />
        <p className="mt-1 whitespace-pre-line text-[8px] font-black uppercase leading-[0.96] text-primary">
          {"Bolão do\ndia"}
        </p>
      </div>
    );
  }
  const side = getExtraBolaoHeroSideVariant(championshipId ?? undefined, title);
  if (side === "copa_brasil") {
    return (
      <div className="flex w-[58px] shrink-0 flex-col items-center justify-center px-0.5 text-center">
        <Image
          src={iconCopaBrasil}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
        />
        <p className="mt-1 whitespace-pre-line text-[8px] font-black uppercase leading-[0.96] text-primary">
          {"Copa do\nBrasil"}
        </p>
      </div>
    );
  }
  if (side === "brasileirao") {
    return (
      <div className="flex w-[58px] shrink-0 flex-col items-center justify-center px-0.5 text-center">
        <Image
          src={iconBrasileirao}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
        />
        <p className="mt-1 whitespace-pre-line text-[8px] font-black uppercase leading-[0.96] text-primary">
          {"Campeonato\nBrasileirão"}
        </p>
      </div>
    );
  }
  if (side === "premier_league") {
    return (
      <div className="flex w-[58px] shrink-0 flex-col items-center justify-center px-0.5 text-center">
        <Image
          src={iconPremierLeague}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
        />
        <p className="mt-1 whitespace-pre-line text-[8px] font-black uppercase leading-[0.96] text-primary">
          {"Premier\nLeague"}
        </p>
      </div>
    );
  }
  return <BolaoIcon type="extra" />;
}

function BolaoIcon({ type }: { type: "copa" | "dia" | "extra" }) {
  const Icon =
    type === "copa" ? Trophy : type === "extra" ? Sparkles : CalendarDays;
  const label =
    type === "copa"
      ? "COPA\n2026"
      : type === "extra"
        ? "BOLÃO\nEXTRA"
        : "BOLÃO\nDO DIA";
  const color = GREEN;

  return (
    <div className="flex w-[58px] shrink-0 flex-col items-center justify-center text-center">
      <div
        className="mb-2 flex size-[38px] items-center justify-center rounded-[11px]"
        style={{ background: `${color}22` }}
        aria-hidden
      >
        <Icon className="size-[19px]" style={{ color }} strokeWidth={2.1} />
      </div>
      <p
        className="whitespace-pre-line text-[11px] font-black uppercase leading-[0.96] tracking-[-0.03em]"
        style={{ color }}
      >
        {label}
      </p>
    </div>
  );
}

function StatusPill({
  status,
  label,
}: {
  status: ActiveDailyBolao["status"] | "ativo";
  label: string;
}) {
  const isActive = status === "ativo";
  const isUsed = status === "usado";
  const tone = isUsed ? "#F87171" : isActive ? GREEN_SOFT : YELLOW;

  return (
    <span
      className="inline-flex h-[18px] items-center rounded-[5px] border px-2 text-[8px] font-black uppercase tracking-[0.12em]"
      style={{ background: `${tone}1F`, borderColor: `${tone}55`, color: tone }}
    >
      <span
        className="mr-1 size-[5px] rounded-full"
        style={{ background: tone }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function RankingPanel({
  position,
  points,
}: {
  position: number | null;
  points: number;
}) {
  return (
    <div
      className="flex min-w-0 flex-col items-center justify-center border-l px-1.5 text-center"
      style={{ borderColor: BORDER }}
    >
      <p className="text-[7px] font-black uppercase leading-[0.95] tracking-[0.06em] text-white/80 min-[380px]:text-[8px]">
        Sua
        <br />
        posição
      </p>
      <p className="mt-1 text-[16px] font-black leading-none text-white min-[380px]:text-[14px]">
        {positionLabel(position)}
      </p>
      <div className="my-3 h-px w-full bg-white/6" />
      <p className="text-[7px] font-black uppercase leading-none tracking-[0.06em] text-white/80 min-[380px]:text-[8px]">
        Pontos
      </p>
      <p
        className="mt-1 whitespace-nowrap text-[12px] font-black leading-none min-[380px]:text-[13px]"
        style={{ color: GREEN }}
      >
        {pointsLabel(points)}
      </p>
    </div>
  );
}

function EmptyBolaoShowcaseCard({
  variant,
}: {
  variant: "principal" | "diario" | "lista" | "resumo";
}) {
  const title =
    variant === "principal"
      ? "Nenhuma cota do bolão principal"
      : variant === "diario"
        ? "Nenhuma cota do bolão do dia"
        : variant === "resumo"
          ? "Sem bolão principal nem do dia"
          : "Nenhum bolão nesta lista";

  return (
    <div
      className="rounded-[16px] px-5 py-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
      style={{ background: SHOWCASE_CARD_BG }}
    >
      <p className="text-[14px] font-black uppercase leading-tight tracking-[0.04em] text-white">
        {title}
      </p>
      <p className="mx-auto mt-2.5 max-w-[280px] text-[11px] leading-[1.45] text-white/48">
        Compre seu ingresso na área de tickets para liberar palpites e
        acompanhar sua posição no ranking.
      </p>
      <Link
        href="/tickets"
        className="mt-4 flex h-[40px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[12px] font-black uppercase tracking-[0.05em] text-[#0E141B] transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99]"
      >
        Ir para tickets
        <ArrowRight className="size-4 shrink-0" strokeWidth={2.6} />
      </Link>
    </div>
  );
}

function ActiveBoloesList({
  items,
  now,
}: {
  items: ActiveBolaoListItem[];
  now: number;
}) {
  if (items.length === 0) {
    return <EmptyBolaoShowcaseCard variant="lista" />;
  }

  return (
    <article
      className="overflow-hidden rounded-[15px] border"
      style={{ background: CARD_ALT, borderColor: BORDER }}
    >
      {items.map((item) => {
        const isPrincipal = item.type === "principal";
        const isExtra = item.type === "extra";
        const progress = Math.max(0, Math.min(100, item.progress ?? 0));

        return (
          <div key={item.id}>
            <div className="grid grid-cols-[68px_minmax(0,1fr)_58px] min-[380px]:grid-cols-[74px_minmax(0,1fr)_64px]">
              <div
                className="flex items-center justify-center border-r"
                style={{ borderColor: BORDER }}
              >
                <ActiveRowBolaoIcon
                  isPrincipal={isPrincipal}
                  isExtra={isExtra}
                  title={item.title}
                  championshipId={item.championshipId}
                />
              </div>

              <Link
                href={item.href}
                className="min-w-0 px-3 py-[16px] transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary active:bg-white/5 min-[380px]:px-4"
              >
                <p className="max-w-[190px] text-[17px] font-black uppercase leading-[0.98] tracking-[-0.03em] text-white min-[380px]:text-[18px]">
                  {item.title}
                </p>
                <p
                  className="mt-2 truncate font-mono text-[12px] font-semibold leading-none text-white/52 min-[380px]:text-[13px]"
                  title={item.id}
                >
                  {item.cotaLabel.replace("Cota #", "Cota #")}
                </p>

                <div className="mt-5">
                  <StatusPill status={item.status} label={item.statusLabel} />
                </div>

                {isPrincipal ? (
                  <div className="mt-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                      <span className="text-[13px] font-semibold leading-[1.02] text-white/55 min-[380px]:text-[14px]">
                        Palpites enviados
                      </span>
                      <span className="whitespace-nowrap text-[15px] font-black leading-none text-white min-[380px]:text-[16px]">
                        {item.sent ?? 0} / {item.total ?? 0}
                      </span>
                    </div>
                    <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${progress}%`, background: GREEN }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-2">
                    <p className="text-[14px] font-medium leading-none text-white/55">
                      {isExtra ? "Jogos da rodada: " : "Jogos do dia: "}
                      <span className="font-black text-white">
                        {item.gamesCount ?? 0} jogos
                      </span>
                    </p>
                    <p className="text-[14px] font-medium leading-none text-white/55">
                      {item.countdownLabel ?? "Fecha em"}:{" "}
                      <span
                        className="font-black"
                        style={{ color: GREEN_SOFT }}
                      >
                        {formatCountdown(item.countdownTargetMs ?? null, now)}
                      </span>
                    </p>
                  </div>
                )}
              </Link>

              <RankingPanel position={item.position} points={item.points} />
            </div>

            {item !== items[items.length - 1] && (
              <div className="h-px bg-white/6" />
            )}
          </div>
        );
      })}
    </article>
  );
}

function AvailableCard({
  href,
  badge,
  badgeTone,
  icon,
  title,
  subtitle,
  bodyLines,
  time,
  price,
  buttonTone,
}: {
  href: string;
  badge: string;
  badgeTone: "lime" | "green";
  icon: "calendar" | "trophy";
  title: string;
  subtitle: string;
  bodyLines: string[];
  time?: string;
  price: string;
  buttonTone: "lime" | "green";
}) {
  const Icon = icon === "calendar" ? CalendarDays : Trophy;
  const badgeColor = badgeTone === "lime" ? GREEN : GREEN_SOFT;
  const buttonColor = buttonTone === "lime" ? GREEN : GREEN_SOFT;

  return (
    <article
      className="relative flex min-h-[255px] flex-1 flex-col items-center rounded-[14px] border px-4 pb-4 pt-[41px] text-center"
      style={{ background: CARD, borderColor: BORDER }}
    >
      <div
        className="absolute left-3 right-3 top-[7px] flex h-[20px] items-center justify-center rounded-full text-[8px] font-black uppercase tracking-[0.18em]"
        style={{ background: badgeColor, color: "#0E141B" }}
      >
        {badge}
      </div>
      <div
        className="flex size-[38px] items-center justify-center rounded-[11px]"
        style={{
          background: `${buttonColor}18`,
        }}
        aria-hidden
      >
        <Icon
          className="size-[19px]"
          style={{ color: buttonColor }}
          strokeWidth={2.1}
        />
      </div>
      <h3 className="mt-4 text-[16px] font-black leading-none text-white">
        {title}
      </h3>
      <p
        className="mt-1.5 text-[12px] font-black uppercase leading-none"
        style={{ color: buttonColor }}
      >
        {subtitle}
      </p>
      <p className="mt-3 min-h-[30px] text-[11px] font-medium leading-tight text-white/48">
        {bodyLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
      {time && (
        <p
          className="mt-1 text-[16px] font-black leading-none"
          style={{ color: GREEN }}
        >
          {time}
        </p>
      )}
      <div
        className="mt-auto w-full border-t pt-4"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <p className="text-[14px] font-black leading-none text-white">
          {price}
        </p>
        <Link
          href={href}
          className="mt-4 flex h-[34px] w-full items-center justify-center rounded-[7px] text-[11px] font-black uppercase tracking-[0.04em] transition-transform hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97]"
          style={{ background: buttonColor, color: "#0E141B" }}
        >
          Entrar
        </Link>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────
   Estado vazio — usuário sem cotas
   ───────────────────────────────────────────────────── */

type NoTicketsProductKind = "principal" | "diario" | "extra";

type NoTicketsProduct = {
  id: string;
  kind: NoTicketsProductKind;
  href: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  prizeTotal: string;
  prizeFirst: string;
  iconSrc: string;
  brandedIcon: boolean;
};

function parseExtraTitleParts(title: string): { name: string; round: string | null } {
  const t = title.trim();
  if (!t.includes(" · ")) return { name: t, round: null };
  const [name, round] = t.split(" · ", 2);
  return { name: (name ?? t).trim(), round: round?.trim() || null };
}

function buildNoTicketsProducts(
  upcoming: BoloesScreenData["upcoming"],
  options: { ticketsExtraOnly: boolean; ticketsHideDaily: boolean },
): NoTicketsProduct[] {
  const items: NoTicketsProduct[] = [];

  if (!options.ticketsExtraOnly) {
    const principalPrizes = SHOWCASE_PRIZES.principal;
    items.push({
      id: "principal",
      kind: "principal",
      href: upcoming.principal.href,
      title: "Bolão do Milhão",
      subtitle: "Copa do Mundo 2026 · todas as rodadas",
      priceLabel: upcoming.principal.priceLabel,
      prizeTotal: principalPrizes.total,
      prizeFirst: principalPrizes.first,
      iconSrc: iconCopaMundo.src,
      brandedIcon: true,
    });

    if (!options.ticketsHideDaily) {
      const dailyPrizes = SHOWCASE_PRIZES.diario;
      items.push({
        id: "diario",
        kind: "diario",
        href: upcoming.daily.href,
        title: "Bolão do Dia",
        subtitle: "Palpites na rodada do dia",
        priceLabel: upcoming.daily.priceLabel,
        prizeTotal: dailyPrizes.total,
        prizeFirst: dailyPrizes.first,
        iconSrc: iconCopaMundo.src,
        brandedIcon: true,
      });
    }
  }

  for (const ex of upcoming.extras) {
    const { name, round } = parseExtraTitleParts(ex.title);
    const variant = getExtraBolaoHeroSideVariant(ex.championshipId, name);
    const icon = extraBolaoIconSrc(variant);
    const extraPrizes = SHOWCASE_PRIZES.extra;
    items.push({
      id: `extra-${ex.championshipId}`,
      kind: "extra",
      href: ex.href,
      title: name,
      subtitle: round ? `${round} · cota extra` : "Cota extra na rodada atual",
      priceLabel: ex.priceLabel,
      prizeTotal: extraPrizes.total,
      prizeFirst: extraPrizes.first,
      iconSrc: icon.src,
      brandedIcon: isExtraBolaoBrandedIcon(variant),
    });
  }

  return items;
}

function CarouselSwipeHint() {
  return (
    <div className="mb-3 flex items-center justify-center gap-2" aria-hidden>
      <span className="inline-flex items-center text-primary/50">
        <ChevronRight className="size-4 rotate-180" strokeWidth={2.5} />
        <ChevronRight className="size-3 -ml-1.5 rotate-180 opacity-60" strokeWidth={2.5} />
      </span>

      <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <MoveHorizontal
          className="size-4 shrink-0 animate-pulse text-primary"
          strokeWidth={2.35}
        />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
          Deslize
        </span>
      </span>

      <span className="inline-flex items-center text-primary/50">
        <ChevronRight className="size-3 opacity-60" strokeWidth={2.5} />
        <ChevronRight className="size-4 -ml-1.5" strokeWidth={2.5} />
      </span>
    </div>
  );
}

function CarouselShell({
  children,
  tone = GREEN,
  itemCount,
}: {
  children: React.ReactNode;
  tone?: string;
  itemCount: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const showCarousel = itemCount > 1;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !showCarousel) return;
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) {
        setActiveIdx(0);
        return;
      }
      const t = el.scrollLeft / max;
      setActiveIdx(
        Math.min(itemCount - 1, Math.max(0, Math.round(t * (itemCount - 1)))),
      );
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [itemCount, showCarousel]);

  return (
    <div>
      {showCarousel ? <CarouselSwipeHint /> : null}
      <div
        ref={scrollRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Carrossel de bolões — deslize para o lado"
      >
        {children}
      </div>
      {showCarousel ? (
        <div className="mt-3 flex justify-center gap-1.5">
          {Array.from({ length: itemCount }, (_, i) => (
            <span
              key={i}
              className={
                i === activeIdx
                  ? "h-1.5 w-6 shrink-0 rounded-full transition-[width,background-color] duration-300"
                  : "size-1.5 shrink-0 rounded-full bg-white/20 transition-[width,background-color] duration-300"
              }
              style={i === activeIdx ? { background: tone } : undefined}
              aria-hidden
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}


function MiniSoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden
    >
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

function ShowcaseHeroStatusPill({
  status,
  label,
}: {
  status: ActiveBolaoListItem["status"];
  label: string;
}) {
  if (status === "ativo") {
    return (
      <span
        className="inline-flex w-fit items-center gap-1 rounded-[4px] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.06em] sm:px-3 sm:text-[10px]"
        style={{ background: GREEN, color: INK }}
      >
        <span aria-hidden>🔥</span>
        Palpites abertos
      </span>
    );
  }
  if (status === "aguardando") {
    return (
      <span
        className="inline-flex w-fit items-center gap-1 rounded-[4px] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.06em] sm:px-3 sm:text-[10px]"
        style={{ background: YELLOW, color: INK }}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-[4px] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.06em] sm:px-3 sm:text-[10px]"
      style={{ background: "#F87171", color: "#fff" }}
    >
      <span
        className="mr-0.5 inline-block size-1.5 shrink-0 rounded-full bg-white/90"
        aria-hidden
      />
      {label}
    </span>
  );
}

function showcaseStatusColor(
  status: ActiveBolaoListItem["status"] | undefined,
  finished: boolean,
): string {
  if (finished || status === "usado") return "#F87171";
  if (status === "ativo") return GREEN;
  if (status === "aguardando") return YELLOW;
  return "rgba(255,255,255,0.85)";
}

function ShowcaseCotaCard({
  href,
  fullWidth,
  logoSrc,
  kind,
  displayTitle,
  cotaLabel,
  status,
  statusLabel,
  countdownLabel,
  countdownTargetMs,
  now,
  ctaLabel,
}: {
  href: string;
  fullWidth?: boolean;
  logoSrc: typeof iconCopaMundo;
  kind: "principal" | "diario" | "extra";
  displayTitle: string;
  cotaLabel?: string;
  status?: ActiveBolaoListItem["status"];
  statusLabel?: string;
  countdownLabel: string;
  countdownTargetMs: number | null;
  now: number;
  ctaLabel: string;
}) {
  const prizes = SHOWCASE_PRIZES[kind];
  const header = showcaseHeaderParts(displayTitle, kind);
  const finished = lockHasPassed(countdownTargetMs, now) || status === "usado";
  const countdownDisplay = finished ? "Encerrado" : formatCountdown(countdownTargetMs, now);
  const timerLabel = finished ? "Encerrado" : countdownLabel.toUpperCase();
  const statusDisplay =
    statusLabel ??
    (finished ? "Encerrado" : status === "ativo" ? "Ativo" : status === "aguardando" ? "Aguardando" : "—");
  const statusColor = showcaseStatusColor(status, finished);

  return (
    <Link
      href={href}
      aria-label={cotaLabel ? `${ctaLabel}, ${cotaLabel}` : ctaLabel}
      className={[
        "group flex min-h-0 flex-col overflow-hidden rounded-[14px] transition-transform duration-300 active:scale-[0.985]",
        fullWidth ? "w-full" : "w-[368px] max-w-[88vw] shrink-0 snap-center",
      ].join(" ")}
      style={{ background: SHOWCASE_CARD_BG }}
    >
      {/* Header — logo + campeonato / premiação */}
      <div className="flex items-start gap-3 px-4 pb-4 pt-4">
        <div className="flex w-[88px] shrink-0 items-center justify-center pt-0.5">
          <Image
            src={logoSrc}
            alt=""
            width={88}
            height={88}
            className="h-[80px] w-[72px] object-contain object-center transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/70">
            {header.category.toUpperCase()}
          </p>
          <h3 className="mt-0.5 text-[22px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-white min-[380px]:text-[24px]">
            {header.title.toUpperCase()}
          </h3>

          <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.14em] text-white/70">
            Premiação total
          </p>
          <p className="mt-1 text-[30px] font-black leading-none tracking-tight text-primary min-[380px]:text-[32px]">
            {prizes.total}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 px-4 mb-2">
        <Trophy className="size-4 shrink-0 text-white" strokeWidth={2.15} aria-hidden />
        <span className="text-[14px] font-bold uppercase tracking-[0.06em] text-white/80">
          1º lugar ganha
        </span>
        <span className="text-[15px] font-black leading-none text-white">{prizes.first}</span>
      </div>
      <div className="mx-4 h-px bg-white/[0.08]" aria-hidden />

      {/* Stats — começa em | status */}
      <div className="grid grid-cols-2 items-stretch px-4 py-4">
        <div className="flex items-center gap-2.5 border-r border-white/[0.08] pr-4">
          <Clock className="size-5 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">
              {timerLabel}
            </p>
            <p className="mt-1 font-mono text-[16px] font-black tabular-nums leading-none text-primary min-[380px]:text-[17px]">
              {countdownDisplay}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 pl-4">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: statusColor }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">
              Status
            </p>
            <p
              className="mt-1 text-[14px] font-black uppercase leading-tight tracking-[0.02em] min-[380px]:text-[15px]"
              style={{ color: statusColor }}
            >
              {statusDisplay}
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-4 pt-1">
        <span className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[11px] bg-primary text-[17px] font-black uppercase tracking-[0.08em] text-[#000] transition-[filter] group-hover:brightness-105 min-[380px]:h-[50px]">
          {ctaLabel}
          <ArrowRight className="size-4 shrink-0" strokeWidth={2.6} aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function UpcomingExtraOfferCard({
  ex,
  now,
  fullWidth,
}: {
  ex: BoloesScreenData["upcoming"]["extras"][number];
  now: number;
  fullWidth?: boolean;
}) {
  const extraSide = getExtraBolaoHeroSideVariant(ex.championshipId, ex.title);
  const ticketImg =
    extraSide === "copa_brasil"
      ? iconCopaBrasil
      : extraSide === "brasileirao"
        ? iconBrasileirao
        : extraSide === "premier_league"
          ? iconPremierLeague
          : ticketBlue;
  const showVerResultados = lockHasPassed(ex.closesAtMs, now);
  const status: ActiveBolaoListItem["status"] = showVerResultados ? "usado" : "aguardando";
  const statusLabel = showVerResultados ? "Encerrado" : "Palpites abertos";

  return (
    <ShowcaseCotaCard
      href={ex.href}
      fullWidth={fullWidth}
      logoSrc={ticketImg}
      kind="extra"
      displayTitle={ex.title}
      status={status}
      statusLabel={statusLabel}
      countdownLabel="Começa em"
      countdownTargetMs={ex.closesAtMs}
      now={now}
      ctaLabel={showVerResultados ? "Ver resultados" : "Fazer palpites"}
    />
  );
}

function ActiveShowcaseCard({
  item,
  now,
  kind,
  fullWidth = false,
}: {
  item: ActiveBolaoListItem;
  now: number;
  kind: "principal" | "diario" | "extra";
  fullWidth?: boolean;
}) {
  const isPrincipal = kind === "principal";
  const isExtra = kind === "extra";
  const extraHero = isExtra
    ? getExtraBolaoHeroSideVariant(item.championshipId, item.title)
    : "generic";
  const image = isPrincipal
    ? iconCopaMundo
    : isExtra
      ? extraHero === "copa_brasil"
        ? iconCopaBrasil
        : extraHero === "brasileirao"
          ? iconBrasileirao
          : extraHero === "premier_league"
            ? iconPremierLeague
            : ticketBlue
      : iconCopaMundo;
  const showVerResultados =
    item.status === "usado" || lockHasPassed(item.countdownTargetMs ?? null, now);

  const countdownLabel =
    item.status === "aguardando" ? "Começa em" : "Fecha em";

  return (
    <ShowcaseCotaCard
      href={item.href}
      fullWidth={fullWidth}
      logoSrc={image}
      kind={kind}
      displayTitle={item.title}
      cotaLabel={item.cotaLabel}
      status={item.status}
      statusLabel={item.statusLabel}
      countdownLabel={countdownLabel}
      countdownTargetMs={item.countdownTargetMs ?? null}
      now={now}
      ctaLabel={showVerResultados ? "Ver resultados" : "Fazer palpites"}
    />
  );
}


function ComoFuncionaPalpitesCard() {

  const [showAll, setShowAll] = useState(false);


  const ink = "#0E141B";
  const steps = [
    {
      n: 1 as const,
      Icon: MousePointerClick,
      label: "Escolha um bolão abaixo",
    },
    {
      n: 2 as const,
      Icon: ClipboardList,
      label: "Clique em \u201CFazer palpites\u201D",
    },
    {
      n: 3 as const,
      Icon: BarChart3,
      label: "Acompanhe sua posição no ranking",
    },
  ];

  return (
    <section
      className="mt-6 mb-6"
      aria-labelledby="como-funciona-palpites-heading"
    >
      <div
        className="overflow-hidden rounded-[14px] border py-5 sm:py-6"
        style={{ background: CARD_ALT, borderColor: BORDER }}
      >
        <h2
          id="como-funciona-palpites-heading"
          className="px-1 text-center text-[16px] font-black uppercase leading-tight tracking-[0.08em] text-balance sm:text-[12px]"
          style={{ color: GREEN }}
        >
          Como funciona? É rápido e fácil!
        </h2>

        {showAll && (
          <div
            className="mt-5 grid grid-cols-3 gap-0 sm:mt-6"
            role="list"
            aria-label="Passos para palpitar"
          >
            {steps.map((step, idx) => {
              const Icon = step.Icon;
              return (
                <div
                  key={step.n}
                  role="listitem"
                  className={[
                    "flex flex-col items-center px-[2px] pb-3 pt-1 text-center sm:px-2 sm:pb-4 relative",
                    idx > 0 ? "border-l border-white/8" : "",
                  ].join(" ")}
                >
                  <span
                    className="flex absolute top-0 left-4 size-[20px] shrink-0 items-center justify-center rounded-full text-[14px] font-black leading-none sm:size-5 sm:text-[10px]"
                    style={{
                      background: GREEN,
                      color: ink,
                    }}
                    aria-hidden
                  >
                    {step.n}
                  </span>

                  <div className="mb-3 relative flex shrink-0 items-center justify-center gap-2 sm:mb-3.5 sm:gap-2.5">
                    <Icon
                      className="size-8 shrink-0 sm:size-9"
                      style={{ color: GREEN }}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                  <p className="w-full px-0.5 text-[13px] font-medium leading-snug text-white/92 text-balance sm:text-[16px]">
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-center mt-4">
          <button
            className="flex items-center gap-1 text-[12px] font-bold uppercase leading-none tracking-[0.2em] text-primary"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? <ArrowUp className="size-4 shrink-0" strokeWidth={2.6} aria-hidden /> : <ArrowDown className="size-4 shrink-0" strokeWidth={2.6} aria-hidden />}
            {showAll ? "Ver menos" : "Ver mais"}
          </button>
        </div>
      </div>
    </section>
  );
}

function noTicketsHeroHeader(product: NoTicketsProduct) {
  if (product.kind === "principal") {
    return { category: "Bolão do Milhão", title: "Copa 2026" };
  }
  if (product.kind === "diario") {
    return { category: "Bolão do dia", title: "Rodada atual" };
  }
  const roundLabel = product.subtitle.split(" · ")[0]?.trim();
  return {
    category: product.title,
    title: roundLabel || product.title,
  };
}

function NoTicketsHeroCard({ product }: { product: NoTicketsProduct }) {
  const header = noTicketsHeroHeader(product);
  const useCopaLogo = product.kind === "principal" || product.kind === "diario";

  return (
    <article
      className="mt-6 overflow-hidden rounded-[16px] border border-white/8 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
      style={{ background: SHOWCASE_CARD_BG }}
    >
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <div className="flex w-[72px] shrink-0 items-center justify-center sm:w-[80px]">
          {useCopaLogo ? (
            <Image
              src={iconCopaMundo}
              alt=""
              width={80}
              height={80}
              className="h-[72px] w-[64px] object-contain sm:h-[80px] sm:w-[72px]"
            />
          ) : (
            <img
              src={product.iconSrc}
              alt=""
              className={
                product.brandedIcon
                  ? "h-[72px] w-[72px] object-contain"
                  : "h-[68px] w-[52px] object-contain"
              }
            />
          )}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/70">
            {header.category}
          </p>
          <h2 className="mt-0.5 text-[22px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-white min-[380px]:text-[24px]">
            {header.title}
          </h2>
          <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.14em] text-white/70">
            Premiação total
          </p>
          <p className="mt-1 text-[28px] font-black leading-none tracking-tight text-primary min-[380px]:text-[32px]">
            {product.prizeTotal}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 px-4 pb-3">
        <Trophy className="size-4 shrink-0 text-white/85" strokeWidth={2.15} aria-hidden />
        <span className="text-[13px] font-bold uppercase tracking-[0.05em] text-white/75">
          1º lugar ganha
        </span>
        <span className="text-[14px] font-black leading-none text-white">
          {product.prizeFirst}
        </span>
      </div>

      <div className="mx-4 h-px bg-white/8" aria-hidden />

      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[16px] text-center font-black uppercase tracking-[0.06em] text-white">
            Nenhuma cota ativa
          </p>
          <p className="mt-1 text-center text-[14px] font-medium leading-snug text-white/80">
            Após o pagamento via PIX, sua cota aparece aqui para palpitar e
            acompanhar o ranking.
          </p>
        </div>
      </div>

      <div className="border-t border-white/8 px-4 py-4">
        <Link
          href={product.href}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[12px] bg-primary text-[16px] font-black uppercase tracking-[0.05em] text-[#0E141B] transition-[filter] hover:brightness-105 active:scale-[0.98]"
        >
          Comprar cota — {product.priceLabel}
          <ArrowRight className="size-4 shrink-0" strokeWidth={2.6} aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function NoTicketsProductRow({ product }: { product: NoTicketsProduct }) {
  return (
    <Link
      href={product.href}
      className="group block overflow-hidden rounded-[14px] border border-white/10 transition-colors hover:border-white/18 active:scale-[0.99]"
      style={{ background: CARD_ALT }}
    >
      <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 p-3.5">
        <div className="flex items-center justify-center">
          <img
            src={product.iconSrc}
            alt=""
            className={
              product.brandedIcon
                ? "h-12 w-12 object-contain"
                : "h-[54px] w-[42px] object-contain"
            }
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-black uppercase leading-tight text-white">
            {product.title}
          </p>
          <p className="mt-1.5 text-[15px] font-bold leading-snug text-white/80">
            {product.subtitle}
          </p>
          <p className="mt-1.5 text-[16px] font-bold text-primary/90">
            Premiação {product.prizeTotal}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-white/70">
            A partir de
          </p>
          <p className="mt-0.5 text-[15px] font-black tabular-nums text-primary">
            {product.priceLabel}
          </p>
          <ChevronRight
            className="ml-auto mt-1.5 size-4 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            strokeWidth={2.4}
            aria-hidden
          />
        </div>
      </div>
    </Link>
  );
}

function NoTicketsState({
  upcoming,
  ticketsExtraOnly = false,
  ticketsHideDaily = false,
}: {
  upcoming: BoloesScreenData["upcoming"];
  ticketsExtraOnly?: boolean;
  ticketsHideDaily?: boolean;
}) {
  const products = useMemo(
    () => buildNoTicketsProducts(upcoming, { ticketsExtraOnly, ticketsHideDaily }),
    [upcoming, ticketsExtraOnly, ticketsHideDaily],
  );

  const heroProduct = ticketsExtraOnly
    ? products[0]
    : products.find((p) => p.kind === "principal") ?? products[0];

  const listProducts = heroProduct
    ? products.filter((p) => p.id !== heroProduct.id)
    : products;

  const featuredPrize =
    heroProduct?.prizeTotal ?? SHOWCASE_PRIZES.principal.total;

  const ticketsHref = ticketsExtraOnly
    ? heroProduct?.href ?? "/tickets?bolao=extra"
    : heroProduct?.href ?? "/tickets";

  const headerEyebrow =
    heroProduct?.kind === "extra"
      ? heroProduct.title
      : heroProduct?.kind === "diario"
        ? "Bolão do dia"
        : "Copa 2026";

  return (
    <div className="overflow-hidden text-white">
      <div className="mx-auto w-full max-w-[430px] px-4 pt-2">
        <header className="mt-2 text-center">
          <p
            className="text-[15px] font-black uppercase tracking-[0.22em]"
            style={{ color: GREEN }}
          >
            {headerEyebrow}
          </p>
          <p className="mx-auto mt-3 max-w-[370px] text-[20px] font-medium leading-snug text-[#c1bebe]">
            Concorra a até{" "}
            <span className="font-black text-primary">{featuredPrize}</span> em
            prêmios. Compre sua cota e comece a palpitar.
          </p>
        </header>

        {heroProduct ? <NoTicketsHeroCard product={heroProduct} /> : null}

        {listProducts.length > 0 ? (
          <section
            className="mt-6 space-y-2.5"
            aria-label="Outros bolões disponíveis"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
              {ticketsExtraOnly ? "Outros campeonatos" : "Outros bolões"}
            </p>
            {listProducts.map((product) => (
              <NoTicketsProductRow key={product.id} product={product} />
            ))}
          </section>
        ) : null}

        <Link
          href={ticketsHref}
          className="mt-6 flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-primary/30 bg-primary/10 text-[16px] font-black uppercase tracking-[0.04em] text-primary transition-colors hover:bg-primary/15 active:scale-[0.98]"
        >
          Ver todos na loja de tickets
          <ArrowRight className="size-4 shrink-0" strokeWidth={2.6} aria-hidden />
        </Link>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <Shield className="size-3.5 shrink-0 text-primary/80" strokeWidth={1.9} aria-hidden />
            Pagamento seguro
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5 shrink-0 text-primary/80" strokeWidth={1.9} aria-hidden />
            Dados protegidos
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Componente principal
   ───────────────────────────────────────────────────── */
export function BoloesClient({
  data,
  ticketsExtraOnly = false,
  ticketsHideDaily = false,
}: {
  data: BoloesScreenData | null;
  /** Alinhado a `TICKETS_EXTRA_ONLY`: oculta vitrines de principal e do dia. */
  ticketsExtraOnly?: boolean;
  /** Alinhado a `TICKETS_HIDE_DAILY`: oculta vitrine/compra do dia; cotas já compradas continuam visíveis. */
  ticketsHideDaily?: boolean;
}) {
  const now = useNow();
  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllPrincipal, setShowAllPrincipal] = useState(false);
  const [showAllDiario, setShowAllDiario] = useState(false);
  const hasTickets = (data?.active.all.length ?? 0) > 0;

  const summary = data?.summary ?? {
    activeCount: 0,
    pendingPredictions: 0,
    bestPosition: null,
  };
  const bestPosition =
    summary.bestPosition == null ? "--" : `#${summary.bestPosition}`;
  const principalItems = (data?.active.all ?? []).filter(
    (item) => item.type === "principal",
  );
  const diarioItems = (data?.active.all ?? []).filter(
    (item) => item.type === "diario",
  );
  const extraItems = (data?.active.all ?? []).filter(
    (item) => item.type === "extra",
  );
  const upcomingExtras = data?.upcoming.extras ?? [];
  const diarioShowcaseItems = useMemo(
    () => sortBoloesByAvailabilityForShowcase(diarioItems),
    [diarioItems],
  );
  const extraShowcaseItems = useMemo(
    () => sortBoloesByAvailabilityForShowcase(extraItems),
    [extraItems],
  );
  /** Um bloco por campeonato extra (Brasileirão, Premier, …), na ordem do servidor. */
  const extraChampionshipIdsOrdered = useMemo(() => {
    const ordered: number[] = [];
    const seen = new Set<number>();
    for (const ex of upcomingExtras) {
      if (!seen.has(ex.championshipId)) {
        seen.add(ex.championshipId);
        ordered.push(ex.championshipId);
      }
    }
    for (const item of extraItems) {
      const id = item.championshipId;
      if (id != null && id > 0 && !seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
    return ordered;
  }, [upcomingExtras, extraItems]);
  const showDiarioShowcase =
    !ticketsExtraOnly && (!ticketsHideDaily || diarioItems.length > 0);

  if (!hasTickets) {
    return (
      <NoTicketsState
        upcoming={data?.upcoming ?? EMPTY_UPCOMING}
        ticketsExtraOnly={ticketsExtraOnly}
        ticketsHideDaily={ticketsHideDaily}
      />
    );
  }

  if (showAllActive) {
    return (
      <div className="min-h-screen bg-black px-[18px] pb-8 pt-[24px] text-white">
        <div className="mx-auto w-full max-w-[390px]">
          <header className="text-center">
            <p
              className="text-[12px] font-black uppercase leading-none tracking-[0.25em]"
              style={{ color: GREEN }}
            >
              Copa 2026
            </p>
            <h1 className="mt-2 text-[25px] font-black uppercase leading-none tracking-[-0.055em] text-white">
              Todos os <span style={{ color: GREEN }}>Bolões</span>
            </h1>
            <p className="mx-auto mt-3 max-w-[282px] text-[12px] font-medium leading-[1.45] text-white/58">
              Escolha uma cota para ver detalhes, palpitar ou acompanhar sua
              posição.
            </p>
          </header>

          <section className="mt-[34px]">
            <div className="mb-[20px] flex items-center justify-between">
              <h2 className="text-[17px] font-black leading-none tracking-[-0.03em] text-white">
                Lista de cotas
              </h2>
              <button
                type="button"
                onClick={() => setShowAllActive(false)}
                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] font-bold leading-none transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
                style={{ color: GREEN }}
              >
                Voltar{" "}
                <ChevronRight className="size-3 rotate-180" strokeWidth={2.6} />
              </button>
            </div>
            <ActiveBoloesList items={data?.active.all ?? []} now={now} />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-black pb-8 text-white">

      <div className="mx-auto w-full px-4">
        <header className="mt-2 w-full text-center">
          <div className="flex w-full items-start justify-center gap-3 sm:gap-3.5">
            <div className="flex min-w-0 flex-col gap-1 text-center">
              <div className="flex flex-wrap items-center justify-center">
                <h2 className="text-[24px] font-black uppercase leading-none tracking-[-0.02em] text-white min-[380px]:text-[24px] text-center">
                  Selecione seu bolão
                </h2>
              </div>
              <p className="text-[16px] font-semibold leading-snug text-[#c1bebe]">
                Escolha abaixo onde deseja palpitar, <span className="text-primary">{summary.activeCount} </span>cotas disponíveis.
              </p>
            </div>
          </div>
        </header>

        {!ticketsExtraOnly && (
          <section className="mt-6">
            {showAllPrincipal ? (
              <div className="space-y-3">
                {principalItems.length > 0 ? (
                  principalItems.map((item) => (
                    <ActiveShowcaseCard
                      key={item.id}
                      item={item}
                      now={now}
                      kind="principal"
                      fullWidth
                    />
                  ))
                ) : (
                  <EmptyBolaoShowcaseCard variant="principal" />
                )}
              </div>
            ) : principalItems.length === 0 ? (
              <EmptyBolaoShowcaseCard variant="principal" />
            ) : principalItems.length === 1 ? (
              <ActiveShowcaseCard
                key={principalItems[0].id}
                item={principalItems[0]}
                now={now}
                kind="principal"
                fullWidth
              />
            ) : (
              <CarouselShell itemCount={principalItems.length}>
                {principalItems.map((item) => (
                  <ActiveShowcaseCard
                    key={item.id}
                    item={item}
                    now={now}
                    kind="principal"
                  />
                ))}
              </CarouselShell>
            )}
          </section>
        )}

        {showDiarioShowcase && (
          <section className="mt-4 mb-6">
            {showAllDiario ? (
              <div className="space-y-3">
                {diarioItems.length > 0 ? (
                  diarioShowcaseItems.map((item) => (
                    <ActiveShowcaseCard
                      key={item.id}
                      item={item}
                      now={now}
                      kind="diario"
                      fullWidth
                    />
                  ))
                ) : (
                  <EmptyBolaoShowcaseCard variant="diario" />
                )}
              </div>
            ) : diarioItems.length === 0 ? (
              <EmptyBolaoShowcaseCard variant="diario" />
            ) : diarioShowcaseItems.length === 1 ? (
              <ActiveShowcaseCard
                key={diarioShowcaseItems[0].id}
                item={diarioShowcaseItems[0]}
                now={now}
                kind="diario"
                fullWidth
              />
            ) : (
              <CarouselShell
                tone={GREEN}
                itemCount={diarioShowcaseItems.length}
              >
                {diarioShowcaseItems.map((item) => (
                  <ActiveShowcaseCard
                    key={item.id}
                    item={item}
                    now={now}
                    kind="diario"
                  />
                ))}
              </CarouselShell>
            )}
          </section>
        )}

        {extraChampionshipIdsOrdered.map((championshipId) => {
          const activeForComp = extraShowcaseItems.filter(
            (item) => item.championshipId === championshipId,
          );
          const upcoming = upcomingExtras.find((ex) => ex.championshipId === championshipId);
          if (activeForComp.length === 0 && !upcoming) return null;

          return (
            <section
              key={championshipId}
              className={ticketsExtraOnly ? "mt-6 mb-6" : "mt-4 mb-6"}
            >
              {activeForComp.length === 0 ? (
                <UpcomingExtraOfferCard ex={upcoming!} now={now} fullWidth />
              ) : activeForComp.length === 1 ? (
                <ActiveShowcaseCard
                  key={activeForComp[0]!.id}
                  item={activeForComp[0]!}
                  now={now}
                  kind="extra"
                  fullWidth
                />
              ) : (
                <CarouselShell tone={GREEN} itemCount={activeForComp.length}>
                  {activeForComp.map((item) => (
                    <ActiveShowcaseCard
                      key={item.id}
                      item={item}
                      now={now}
                      kind="extra"
                    />
                  ))}
                </CarouselShell>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
