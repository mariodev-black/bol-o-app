"use client";
import bannerBoloes from "@/app/assets/banner-meus-bolao.png";
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
  MousePointerClick,
  Shield,
  Ticket,
  Trophy,
  Users,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import trofeuBoloes from "@/app/assets/trofeu-boloes.png";
import bgPixel from "@/app/assets/bg-hero-pixels.png";
import ticketGold from "@/app/assets/ticket-gold.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import { isCopaDoBrasilChampionshipTitle } from "@/lib/boloes-copa-brasil-branding";
import { CotaCpa } from "../components/ui/cota_cpa";
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
};

export type BoloesScreenData = {
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
/** Bolão extra: teal claro alinhado ao verde primário (#B1EB0B) e ao tema escuro do app. */
const EXTRA_ACCENT = "#2DD4BF";
const CARD = "#111111";
const CARD_ALT = "#0F0F0F";
const BORDER = "rgba(255,255,255,0.06)";
const INK = "#0E141B";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return now;
}

function formatCountdown(targetMs: number | null, now: number): string {
  if (!targetMs) return "--:--:--";
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
      className="flex h-[121px] flex-1 flex-col items-center justify-center rounded-[13px] border px-2 text-center shadow-[0_16px_28px_rgba(0,0,0,0.28)] transition-transform active:scale-[0.98]"
      style={{ background: CARD, borderColor: BORDER }}
    >
      <div
        className="mb-3 flex size-[25px] items-center justify-center rounded-[7px] border"
        style={{
          background: `${tone}18`,
          borderColor: `${tone}22`,
          boxShadow: `0 0 14px ${tone}1F`,
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
}: {
  isPrincipal: boolean;
  isExtra: boolean;
  title: string;
}) {
  if (isExtra && isCopaDoBrasilChampionshipTitle(title)) {
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
  return <BolaoIcon type={isPrincipal ? "copa" : isExtra ? "extra" : "dia"} />;
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
  const color =
    type === "copa" ? GREEN_SOFT : type === "extra" ? EXTRA_ACCENT : GREEN;

  return (
    <div className="flex w-[58px] shrink-0 flex-col items-center justify-center text-center">
      <div
        className="mb-2 flex size-[38px] items-center justify-center rounded-[11px]"
        style={{ background: `${color}22`, boxShadow: `0 0 20px ${color}24` }}
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
      <p className="mt-1 text-[13px] font-black leading-none text-white min-[380px]:text-[14px]">
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
      className="rounded-[15px] border px-5 py-6 text-center shadow-[0_18px_38px_rgba(0,0,0,0.42)]"
      style={{ background: CARD_ALT, borderColor: BORDER }}
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
        className="mt-4 flex h-[40px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[12px] font-black uppercase tracking-[0.05em] text-[#0E141B] shadow-[0_4px_20px_rgba(177,235,11,0.35)] transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99]"
      >
        Ir para tickets
        <ArrowRight className="size-4 shrink-0" strokeWidth={2.6} />
      </Link>
    </div>
  );
}

function ActiveBoloesCard({
  principal,
  diario,
  now,
}: {
  principal: ActivePrincipalBolao | null;
  diario: ActiveDailyBolao | null;
  now: number;
}) {
  const detailsHref = principal?.href ?? diario?.href ?? "/tickets";

  if (!principal && !diario) return <EmptyBolaoShowcaseCard variant="resumo" />;

  return (
    <article
      className="overflow-hidden rounded-[15px] border shadow-[0_18px_38px_rgba(0,0,0,0.42)]"
      style={{ background: CARD_ALT, borderColor: BORDER }}
    >
      {principal && (
        <div className="grid grid-cols-[58px_minmax(0,1fr)_72px]">
          <div
            className="flex items-center justify-center border-r"
            style={{ borderColor: BORDER }}
          >
            <BolaoIcon type="copa" />
          </div>
          <Link
            href={principal.href}
            className="min-w-0 px-3 py-[13px] transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary active:bg-white/5"
          >
            <p className="text-[13px] font-black uppercase leading-none text-white">
              {principal.title}
            </p>
            <p className="mt-1.5 text-[12px] font-medium leading-none text-white/58">
              {principal.cotaLabel}
            </p>
            <div className="mt-3">
              <StatusPill status="ativo" label={principal.statusLabel} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold leading-none text-white/58">
                Palpites enviados
              </span>
              <span className="text-[12px] font-black leading-none text-white">
                {principal.sent} / {principal.total}
              </span>
            </div>
            <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full"
                style={{ width: `${principal.progress}%`, background: GREEN }}
              />
            </div>
          </Link>
          <RankingPanel
            position={principal.position}
            points={principal.points}
          />
        </div>
      )}

      {principal && diario && <div className="h-px bg-white/6" />}

      {diario && (
        <div className="grid grid-cols-[58px_minmax(0,1fr)_72px]">
          <div
            className="flex items-center justify-center border-r"
            style={{ borderColor: BORDER }}
          >
            <BolaoIcon type="dia" />
          </div>
          <Link
            href={diario.href}
            className="min-w-0 px-3 py-[13px] transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary active:bg-white/5"
          >
            <p className="text-[13px] font-black uppercase leading-none text-white">
              {diario.title}
            </p>
            <p className="mt-1.5 text-[12px] font-medium leading-none text-white/58">
              {diario.cotaLabel}
            </p>
            <div className="mt-3">
              <StatusPill status={diario.status} label={diario.statusLabel} />
            </div>
            <p className="mt-3 text-[12px] font-medium leading-none text-white/58">
              Jogos do dia:{" "}
              <span className="font-black text-white">
                {diario.gamesCount} jogos
              </span>
            </p>
            <p className="mt-1.5 text-[12px] font-medium leading-none text-white/58">
              {diario.countdownLabel}:{" "}
              <span className="font-black" style={{ color: GREEN_SOFT }}>
                {formatCountdown(diario.countdownTargetMs, now)}
              </span>
            </p>
          </Link>
          <RankingPanel position={diario.position} points={diario.points} />
        </div>
      )}

      <div className="px-3 pb-3 pt-2">
        <Link
          href={detailsHref}
          className="flex h-[36px] w-full items-center justify-center rounded-[8px] border text-[12px] font-black uppercase tracking-[0.04em] text-white/62 transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] active:bg-white/5"
          style={{ borderColor: "rgba(177,235,11,0.18)" }}
        >
          Ver detalhes
        </Link>
      </div>
    </article>
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
      className="overflow-hidden rounded-[15px] border shadow-[0_18px_38px_rgba(0,0,0,0.42)]"
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
                      {isExtra
                        ? "Jogos neste campeonato (data da cota): "
                        : "Jogos do dia: "}
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
      className="relative flex min-h-[255px] flex-1 flex-col items-center rounded-[14px] border px-4 pb-4 pt-[41px] text-center shadow-[0_18px_36px_rgba(0,0,0,0.38)]"
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
          boxShadow: `0 0 18px ${buttonColor}20`,
        }}
        aria-hidden
      >
        <Icon
          className="size-[19px]"
          style={{ color: buttonColor }}
          strokeWidth={2.1}
        />
      </div>
      <h3 className="mt-4 text-[13px] font-black leading-none text-white">
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
          className="mt-1 text-[13px] font-black leading-none"
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

const INCLUDED = [
  "Ranking nacional com + de 124 mil participantes",
  "Top 10% premiado — do 1° ao 20.000° lugar",
  "Mais de R$ 1 milhão em prêmios no total",
  "Palpites em todos os jogos da Copa 2026",
  "Placar exato vale pontos extras no ranking",
];

const STATS = [
  { icon: Users, value: "+124.562", label: "Participantes" },
  { icon: Trophy, value: "+R$ 900K", label: "Já pagos em prêmios" },
  { icon: Shield, value: "TOP 10%", label: "Participantes premiados" },
  { icon: Check, value: "100%", label: "Seguro e verificado" },
];

const PACKAGES = [
  {
    qty: 1 as const,
    label: "1 COTA",
    priceMain: "R$39",
    priceDec: ",90",
    unit: "Por cota",
    saving: null,
  },
  {
    qty: 3 as const,
    label: "3 COTAS",
    priceMain: "R$99",
    priceDec: ",00",
    unit: "R$33,00 / cota",
    saving: "-R$21",
  },
  {
    qty: 5 as const,
    label: "5 COTAS",
    priceMain: "R$159",
    priceDec: ",00",
    unit: "R$31,80 / cota",
    saving: "-R$40",
  },
];

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
  const showNav = itemCount > 1;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !showNav) return;
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
  }, [itemCount, showNav]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * el.clientWidth * 0.92,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {showNav && (
        <>
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            className="absolute -left-2 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/80 shadow-[0_8px_22px_rgba(0,0,0,0.45)] backdrop-blur"
            aria-label="Item anterior"
          >
            <ChevronRight className="size-4 rotate-180" strokeWidth={2.6} />
          </button>
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            className="absolute -right-2 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/80 shadow-[0_8px_22px_rgba(0,0,0,0.45)] backdrop-blur"
            aria-label="Próximo item"
          >
            <ChevronRight className="size-4" strokeWidth={2.6} />
          </button>
        </>
      )}
      {showNav && (
        <div className="mt-0 flex justify-center gap-1.5">
          {Array.from({ length: itemCount }, (_, i) => (
            <span
              key={i}
              className={
                i === activeIdx
                  ? "h-1.5 w-6 shrink-0 rounded-full transition-[width,opacity]"
                  : "size-1.5 shrink-0 rounded-full bg-white/20 transition-[width,opacity]"
              }
              style={i === activeIdx ? { background: tone } : undefined}
              aria-hidden
            />
          ))}
        </div>
      )}
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

function UpcomingExtraOfferCard({
  ex,
  now,
  fullWidth,
}: {
  ex: BoloesScreenData["upcoming"]["extras"][number];
  now: number;
  fullWidth?: boolean;
}) {
  const isCopaBr = isCopaDoBrasilChampionshipTitle(ex.title);
  const accent = isCopaBr ? GREEN : EXTRA_ACCENT;
  const ticketImg = isCopaBr ? iconCopaBrasil : ticketBlue;
  const showVerResultados = lockHasPassed(ex.closesAtMs, now);

  return (
    <Link
      href={ex.href}
      aria-label={showVerResultados ? "Ver resultados" : "Fazer palpites"}
      className={[
        "group relative flex min-h-0 flex-col overflow-hidden rounded-[18px] border bg-[#121212] shadow-[0_20px_48px_rgba(0,0,0,0.55)] transition-transform duration-300 active:scale-[0.985]",
        fullWidth ? "w-full" : "w-[368px] max-w-[88vw] shrink-0 snap-center",
      ].join(" ")}
      style={{
        borderColor: accent,
        boxShadow: `0 20px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 28px ${GREEN}33`,
      }}
    >
      <div
        className="pointer-events-none absolute -left-16 -top-12 size-36 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-95"
        style={{ background: `${GREEN}22` }}
        aria-hidden
      />

      <div className="relative z-10 grid min-h-[132px] grid-cols-[minmax(0,92px)_minmax(0,1fr)_minmax(0,78px)] min-[380px]:grid-cols-[100px_minmax(0,1fr)_84px]">
        {/* Coluna esquerda — arte + rótulo */}
        <div
          className="relative flex flex-col items-center justify-center border-r border-white/8 px-2 py-4"
          style={{
            background: `radial-gradient(circle at 50% 38%, ${GREEN}28 0%, rgba(255,255,255,0.02) 42%, transparent 70%)`,
          }}
        >
          <Image
            src={ticketImg}
            alt=""
            width={88}
            height={88}
            className="h-[76px] w-[68px] object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {isCopaBr ? (
            <div className="mt-1.5 text-center leading-tight">
              <p className="text-[9px] font-semibold text-white/85">Copa do</p>
              <p
                className="text-[11px] font-black uppercase tracking-wide"
                style={{ color: GREEN }}
              >
                Brasil
              </p>
            </div>
          ) : (
            <div className="mt-1.5 text-center leading-tight">
              <p className="text-[9px] font-semibold text-white/85">Bolão</p>
              <p
                className="text-[11px] font-black uppercase tracking-wide"
                style={{ color: accent }}
              >
                Extra
              </p>
            </div>
          )}
        </div>

        {/* Meio — título, status, infos */}
        <div className="relative z-10 flex min-w-0 flex-col justify-center border-r border-white/8 px-3 py-3.5 min-[380px]:px-3.5">
          <h3 className="text-[13px] font-black uppercase leading-[1.05] tracking-[-0.02em] text-white min-[380px]:text-[15px]">
            {ex.title}
          </h3>

          <span
            className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-[4px] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.06em] sm:px-3 sm:text-[10px]"
            style={{ background: GREEN, color: INK }}
          >
            <span aria-hidden>🔥</span>
            Palpites abertos
          </span>

          <div className="mt-3 space-y-2">
            <p className="flex items-center gap-2 text-[11px] font-medium leading-snug text-white min-[380px]:text-[12px]">
              <MiniSoccerBallIcon className="size-4 shrink-0" />
              <span>
                <span className="font-black">{ex.gamesCount}</span> jogos nesta
                rodada
              </span>
            </p>
            <p className="flex items-center gap-2 text-[11px] font-medium leading-snug text-white min-[380px]:text-[12px]">
              <Clock
                className="size-4 shrink-0 text-white/90"
                strokeWidth={2.1}
                aria-hidden
              />
              <span>
                {showVerResultados ? (
                  <span className="text-[12px] font-black uppercase tracking-wide text-white/55 min-[380px]:text-[13px]">
                    Finalizado
                  </span>
                ) : (
                  <>
                    Fecha em:{" "}
                    <span
                      className="font-mono text-[12px] font-black tabular-nums min-[380px]:text-[13px]"
                      style={{ color: GREEN }}
                    >
                      {formatCountdown(ex.closesAtMs, now)}
                    </span>
                  </>
                )}
              </span>
            </p>
          </div>

          <p className="mt-2.5 text-[10px] font-medium leading-none text-white/45">
            A partir de{" "}
            <span className="font-bold text-white/70">{ex.priceLabel}</span>
          </p>
        </div>

        {/* Direita — stats (placeholder até ter cota) */}
        <div className="relative z-10 flex min-w-0 flex-col items-center justify-center px-1.5 py-3 text-center min-[380px]:px-2">
          <p className="text-[7px] font-black uppercase leading-none tracking-[0.08em] text-white/55 min-[380px]:text-[8px]">
            Sua posição
          </p>
          <p
            className="mt-1.5 text-[17px] font-black leading-none min-[380px]:text-[19px]"
            style={{ color: GREEN }}
          >
            —
          </p>
          <div className="my-2.5 h-px w-[46px] bg-white/10 min-[380px]:w-[52px]" />
          <p className="text-[7px] font-black uppercase tracking-[0.08em] text-white/55 min-[380px]:text-[8px]">
            Pontos
          </p>
          <p
            className="mt-1.5 text-[13px] font-black leading-none min-[380px]:text-[14px]"
            style={{ color: GREEN }}
          >
            —
          </p>
        </div>
      </div>

      <div className="relative z-10 px-3 pb-3.5 pt-1">
        <span
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[11px] font-black uppercase tracking-[0.06em] shadow-[0_6px_22px_rgba(177,235,11,0.32)] transition-[filter] group-hover:brightness-105 min-[380px]:h-12 min-[380px]:text-[12px]"
          style={{ background: GREEN, color: INK }}
        >
          {showVerResultados ? "Ver resultados" : "Fazer palpites"}
          <ArrowRight className="size-4 shrink-0" strokeWidth={2.6} aria-hidden />
        </span>
      </div>
    </Link>
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
        className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-[4px] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.06em] sm:px-3 sm:text-[10px]"
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
        className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-[4px] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.06em] sm:px-3 sm:text-[10px]"
        style={{ background: YELLOW, color: INK }}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-[4px] px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.06em] sm:px-3 sm:text-[10px]"
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
  const progress = Math.max(0, Math.min(100, item.progress ?? 0));
  const isCopaBrExtra = isExtra && isCopaDoBrasilChampionshipTitle(item.title);
  const tone = isPrincipal
    ? GREEN
    : isCopaBrExtra
      ? GREEN
      : isExtra
        ? EXTRA_ACCENT
        : YELLOW;
  const image = isPrincipal
    ? ticketGold
    : isCopaBrExtra
      ? iconCopaBrasil
      : ticketBlue;
  const showVerResultados =
    item.status === "usado" ||
    lockHasPassed(item.countdownTargetMs ?? null, now);

  return (
    <Link
      href={item.href}
      aria-label={showVerResultados ? "Ver resultados" : "Fazer palpites"}
      className={[
        "group relative flex min-h-0 flex-col overflow-hidden rounded-[18px] border bg-[#121212] shadow-[0_20px_48px_rgba(0,0,0,0.55)] transition-transform duration-300 active:scale-[0.985]",
        fullWidth ? "w-full" : "w-[368px] max-w-[88vw] shrink-0 snap-center",
      ].join(" ")}
      style={{
        borderColor: tone,
        boxShadow: `0 20px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 28px ${GREEN}33`,
      }}
    >
      <div
        className="pointer-events-none absolute -left-16 -top-12 size-36 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-95"
        style={{ background: `${GREEN}22` }}
        aria-hidden
      />

      <div className="relative z-10 grid min-h-[132px] grid-cols-[minmax(0,92px)_minmax(0,1fr)_minmax(0,78px)] min-[380px]:grid-cols-[100px_minmax(0,1fr)_84px]">
        <div
          className="relative flex flex-col items-center justify-center border-r border-white/8 px-2 py-4"
          style={{
            background: `radial-gradient(circle at 50% 38%, ${GREEN}28 0%, rgba(255,255,255,0.02) 42%, transparent 70%)`,
          }}
        >
          <Image
            src={image}
            alt=""
            width={88}
            height={88}
            className="h-[76px] w-[68px] object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {isPrincipal ? (
            <div className="mt-1.5 text-center leading-tight">
              <p className="whitespace-pre-line text-[9px] font-semibold text-white/85">
                {"FIFA\nWorld Cup"}
              </p>
              <p
                className="text-[11px] font-black uppercase tracking-wide"
                style={{ color: GREEN }}
              >
                2026
              </p>
            </div>
          ) : isCopaBrExtra ? (
            <div className="mt-1.5 text-center leading-tight">
              <p className="text-[9px] font-semibold text-white/85">Copa do</p>
              <p
                className="text-[11px] font-black uppercase tracking-wide"
                style={{ color: GREEN }}
              >
                Brasil
              </p>
            </div>
          ) : (
            <div className="mt-1.5 text-center leading-tight">
              <p className="text-[9px] font-semibold text-white/85">Bolão</p>
              <p
                className="text-[11px] font-black uppercase tracking-wide"
                style={{ color: tone }}
              >
                {isExtra ? "Extra" : "Do dia"}
              </p>
            </div>
          )}
        </div>

        <div className="relative z-10 flex min-w-0 flex-col justify-center border-r border-white/8 px-3 py-3.5 min-[380px]:px-3.5">
          <h3 className="text-[13px] font-black uppercase leading-[1.05] tracking-[-0.02em] text-white min-[380px]:text-[15px]">
            {item.title}
          </h3>
          <p className="mt-1.5 font-mono text-[10px] font-semibold leading-none text-white/50 min-[380px]:text-[11px]">
            {item.cotaLabel}
          </p>

          <ShowcaseHeroStatusPill
            status={item.status}
            label={item.statusLabel}
          />

          <div className="mt-3 space-y-2">
            {isPrincipal ? (
              <>
                <p className="flex items-center gap-2 text-[11px] font-medium leading-snug text-white min-[380px]:text-[12px]">
                  <MiniSoccerBallIcon className="size-4 shrink-0" />
                  <span>
                    <span className="font-black">{item.sent ?? 0}</span> /{" "}
                    <span className="font-black">{item.total ?? 0}</span>{" "}
                    palpites enviados
                  </span>
                </p>
                <p className="flex items-center gap-2 text-[11px] font-medium leading-snug text-white min-[380px]:text-[12px]">
                  <Clock
                    className="size-4 shrink-0 text-white/90"
                    strokeWidth={2.1}
                    aria-hidden
                  />
                  <span>
                    {showVerResultados ? (
                      <span className="text-[12px] font-black uppercase tracking-wide text-white/55 min-[380px]:text-[13px]">
                        Finalizado
                      </span>
                    ) : (
                      <>
                        Fecha em:{" "}
                        <span
                          className="font-mono text-[12px] font-black tabular-nums min-[380px]:text-[13px]"
                          style={{ color: GREEN }}
                        >
                          {formatCountdown(
                            item.countdownTargetMs ?? null,
                            now,
                          )}
                        </span>
                      </>
                    )}
                  </span>
                </p>
                <div className="pt-0.5">
                  <div className="h-[5px] overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${progress}%`,
                        background: `linear-gradient(90deg, ${tone}, #F3FF8A)`,
                        boxShadow: `0 0 10px ${tone}70`,
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-[11px] font-medium leading-snug text-white min-[380px]:text-[12px]">
                  <MiniSoccerBallIcon className="size-4 shrink-0" />
                  <span>
                    <span className="font-black">{item.gamesCount ?? 0}</span>{" "}
                    {isExtra
                      ? "jogos nesta rodada"
                      : "jogos neste dia"}
                  </span>
                </p>
                <p className="flex items-center gap-2 text-[11px] font-medium leading-snug text-white min-[380px]:text-[12px]">
                  <Clock
                    className="size-4 shrink-0 text-white/90"
                    strokeWidth={2.1}
                    aria-hidden
                  />
                  <span>
                    {showVerResultados ? (
                      <span className="text-[12px] font-black uppercase tracking-wide text-white/55 min-[380px]:text-[13px]">
                        Finalizado
                      </span>
                    ) : (
                      <>
                        {item.countdownLabel ?? "Fecha em"}:{" "}
                        <span
                          className="font-mono text-[12px] font-black tabular-nums min-[380px]:text-[13px]"
                          style={{ color: GREEN }}
                        >
                          {formatCountdown(
                            item.countdownTargetMs ?? null,
                            now,
                          )}
                        </span>
                      </>
                    )}
                  </span>
                </p>
              </>
            )}
          </div>
        </div>

        <div className="relative z-10 flex min-w-0 flex-col items-center justify-center px-1.5 py-3 text-center min-[380px]:px-2">
          <p className="text-[7px] font-black uppercase leading-none tracking-[0.08em] text-white/55 min-[380px]:text-[8px]">
            Sua posição
          </p>
          <p
            className="mt-1.5 text-[17px] font-black leading-none min-[380px]:text-[19px]"
            style={{ color: GREEN }}
          >
            {positionLabel(item.position)}
          </p>
          <div className="my-2.5 h-px w-[46px] bg-white/10 min-[380px]:w-[52px]" />
          <p className="text-[7px] font-black uppercase tracking-[0.08em] text-white/55 min-[380px]:text-[8px]">
            Pontos
          </p>
          <p
            className="mt-1.5 text-[13px] font-black leading-none min-[380px]:text-[14px]"
            style={{ color: GREEN }}
          >
            {pointsLabel(item.points)}
          </p>
        </div>
      </div>

      <div className="relative z-10 px-3 pb-3.5 pt-1">
        <span
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[11px] font-black uppercase tracking-[0.06em] shadow-[0_6px_22px_rgba(177,235,11,0.32)] transition-[filter] group-hover:brightness-105 min-[380px]:h-12 min-[380px]:text-[12px]"
          style={{ background: GREEN, color: INK }}
        >
          {showVerResultados ? "Ver resultados" : "Fazer palpites"}
          <ArrowRight className="size-4 shrink-0" strokeWidth={2.6} aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function ComoFuncionaPalpitesCard() {
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
        className="overflow-hidden rounded-[14px] border py-5 shadow-[0_16px_36px_rgba(0,0,0,0.35)] sm:py-6"
        style={{ background: CARD_ALT, borderColor: BORDER }}
      >
        <h2
          id="como-funciona-palpites-heading"
          className="px-1 text-center text-[13px] font-black uppercase leading-tight tracking-[0.08em] text-balance sm:text-[12px]"
          style={{ color: GREEN }}
        >
          Como funciona? É rápido e fácil!
        </h2>

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
                    boxShadow: `0 0 10px ${GREEN}45`,
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
      </div>
    </section>
  );
}

function NoTicketsState({ priceLabel }: { priceLabel: string }) {
  const [selectedPkg, setSelectedPkg] = useState<1 | 3 | 5>(1);
  const currentPkg = PACKAGES.find((p) => p.qty === selectedPkg)!;

  return (
    <div className="min-h-screen bg-black pb-10 text-white">
      {/* ── Banner ──────────────────────────────────── */}
      <div className="w-full bg-black">
        {/* text block */}
        <div className="px-5 pb-2 text-center">
          <span className="inline-flex items-center rounded-[8px] px-4 py-1.5 text-[12px] font-black uppercase tracking-[0.22em] text-primary bg-primary/20 border border-primary/60">
            Valendo
          </span>
          <h1 className="mt-5 text-[36px] font-black uppercase leading-[0.9] tracking-[-0.02em] text-white">
            +R$ 1 Milhão
            <br />
            <span className="text-primary">em Prêmios!</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[300px] text-[13px] font-medium leading-normal text-white/55">
            Entre agora no maior bolão da Copa do Brasil.
          </p>
          <p className="mt-1 text-[13px] font-bold text-primary">
            1 em cada 10 participantes será premiado.
          </p>
        </div>

        {/* trophy image — standalone, full width */}
        <Image
          src={trofeuBoloes}
          alt="Troféu Copa do Mundo"
          className="h-auto w-full object-contain"
          priority
        />
      </div>

      {/* ── Body ──────────────────────────────────── */}
      <div className="relative z-10 mx-auto w-full max-w-[430px] -mt-10 space-y-8 px-4">
        {/* Pricing card */}
        <div
          className="rounded-[16px] px-5 py-5 text-center"
          style={{
            background: "#111",
            border: "1px solid rgba(177,235,11,0.18)",
            boxShadow: "0 0 32px rgba(177,235,11,0.06) inset",
          }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
            Cota Oficial Copa 2026
          </p>
          <p className="mt-3 text-[14px] font-semibold text-white/80 line-through">
            R$ 59,90
          </p>
          <p className="mt-1 text-[44px] font-black leading-none tracking-[-0.03em] text-primary">
            R$ 39,90
          </p>
          <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.2em] text-white/80">
            Por Cota
          </p>
        </div>

        {/* CTA principal */}
        <Link
          href="/tickets"
          className="flex h-[58px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-primary text-[14px] font-black uppercase tracking-[0.04em] text-[#0E141B] shadow-[0_4px_28px_rgba(177,235,11,0.55)] transition-[filter] hover:brightness-105 active:scale-[0.98]"
        >
          Quero disputar o milhão
          <ArrowRight className="size-[18px]" strokeWidth={2.8} />
        </Link>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
            <Shield className="size-3.5 shrink-0" strokeWidth={1.8} />
            Pagamento seguro
          </span>
          <span className="h-3 w-px bg-white/12" aria-hidden />
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
            <Lock className="size-3.5 shrink-0" strokeWidth={1.8} />
            Dados protegidos
          </span>
        </div>

        {/* Stats 2×2 */}
        <div className="grid grid-cols-2 gap-2.5">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-[13px] border border-white/7 px-4 py-3.5"
              style={{ background: "#111" }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 border border-primary/20">
                <Icon className="size-[17px] text-primary" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[16px] font-black leading-none text-white">
                  {value}
                </p>
                <p className="mt-1 text-[9px] font-semibold leading-tight text-white/82">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* O que está incluído */}
        <div>
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-white/80">
            O que está incluído
          </p>
          <div
            className="overflow-hidden rounded-[16px] border border-white/8"
            style={{ background: "#111" }}
          >
            {/* header do card */}
            <div className="flex items-center gap-3 border-b border-white/7 px-4 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 border border-primary/20">
                <Trophy className="size-[17px] text-primary" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-black uppercase leading-none text-white">
                  Bolão Principal
                </p>
                <span className="mt-1.5 inline-flex items-center rounded-[5px] bg-primary/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-primary">
                  Cota Oficial Copa 2026
                </span>
              </div>
            </div>

            {/* itens */}
            <div className="space-y-0 px-4 py-3">
              {INCLUDED.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2.5 py-2.5 border-b border-white/5 last:border-0"
                >
                  <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10">
                    <Check className="size-3 text-primary" strokeWidth={3} />
                  </span>
                  <p className="text-[12px] font-medium leading-snug text-white/75">
                    {item}
                  </p>
                </div>
              ))}
            </div>

            {/* footer */}
            <div className="flex items-start gap-2.5 border-t border-white/7 px-4 py-3.5">
              <ArrowRight
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                strokeWidth={2.5}
              />
              <p className="text-[11px] font-medium leading-snug text-white/50">
                Você concorre ao ranking geral e pode ser um dos{" "}
                <span className="font-bold text-white/80">
                  +20.000 premiados
                </span>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Escolha seu pacote */}
        <div>
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-white/80">
            Escolha seu pacote
          </p>

          {/* card wrapper */}
          <div
            className="overflow-hidden rounded-[18px] border border-white/8"
            style={{ background: "#141414" }}
          >
            {/* header */}
            <div className="px-4 pb-4 pt-5">
              <p className="text-[17px] font-black leading-tight text-white">
                Aumente suas chances
              </p>
              <p className="mt-1.5 text-[12px] font-medium leading-snug text-white/80">
                Mais cotas = mais posições no ranking = mais chances de ganhar
              </p>
            </div>

            <div className="mx-4 h-px bg-white/8" />

            {/* packages grid */}
            <div className="grid grid-cols-3 gap-2 p-4">
              {PACKAGES.map((pkg) => {
                const active = selectedPkg === pkg.qty;
                return (
                  <button
                    key={pkg.qty}
                    type="button"
                    onClick={() => setSelectedPkg(pkg.qty)}
                    className={[
                      "relative flex flex-col rounded-[12px] border p-2.5 text-left transition-all active:scale-[0.97]",
                      active
                        ? "border-primary bg-primary/10 shadow-[0_0_18px_rgba(177,235,11,0.15)]"
                        : "border-white/10 bg-white/3",
                    ].join(" ")}
                  >
                    {/* top row: radio + badge */}
                    <div className="flex items-center justify-between">
                      {/* radio circle */}
                      <span
                        className={[
                          "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2",
                          active ? "border-primary" : "border-white/25",
                        ].join(" ")}
                      >
                        {active && (
                          <span className="size-[8px] rounded-full bg-primary" />
                        )}
                      </span>
                      {/* savings badge */}
                      {pkg.saving && (
                        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[8px] font-black text-primary">
                          {pkg.saving}
                        </span>
                      )}
                    </div>

                    {/* label */}
                    <p
                      className={`mt-2 text-[9px] font-black uppercase tracking-wide ${active ? "text-primary" : "text-white/80"}`}
                    >
                      {pkg.label}
                    </p>

                    {/* price */}
                    <p
                      className={`mt-1 tabular-nums leading-none ${active ? "text-white" : "text-white/65"}`}
                    >
                      <span className="text-[16px] font-black">
                        {pkg.priceMain}
                      </span>
                      <span className="text-[11px] font-bold">
                        {pkg.priceDec}
                      </span>
                    </p>

                    {/* per-unit */}
                    <p className="mt-1 text-[8px] font-medium leading-tight text-white/80">
                      {pkg.unit}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* CTA button inside the card */}
            <div className="px-4 pb-2">
              <Link
                href="/tickets"
                className="flex h-[56px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-primary text-[13px] font-black uppercase tracking-[0.05em] text-[#0E141B] shadow-[0_4px_24px_rgba(177,235,11,0.45)] transition-[filter] hover:brightness-105 active:scale-[0.98]"
              >
                Garantir {currentPkg.label.toLowerCase()} —{" "}
                {currentPkg.priceMain}
                {currentPkg.priceDec}
                <ChevronRight className="size-5 shrink-0" strokeWidth={2.8} />
              </Link>
            </div>

            {/* trust bar inside the card */}
            <div className="flex items-center justify-around px-4 py-4">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white/30">
                <Lock className="size-3 shrink-0" strokeWidth={1.8} />
                100% Seguro
              </span>
              <span className="h-3 w-px bg-white/12" aria-hidden />
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white/30">
                <Shield className="size-3 shrink-0" strokeWidth={1.8} />
                Dados protegidos
              </span>
              <span className="h-3 w-px bg-white/12" aria-hidden />
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white/30">
                <Check className="size-3 shrink-0" strokeWidth={2.2} />
                Oficial
              </span>
            </div>
          </div>
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
}: {
  data: BoloesScreenData | null;
  /** Alinhado a `TICKETS_EXTRA_ONLY`: oculta vitrines de principal e do dia. */
  ticketsExtraOnly?: boolean;
}) {
  const now = useNow();
  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllPrincipal, setShowAllPrincipal] = useState(false);
  const [showAllDiario, setShowAllDiario] = useState(false);
  const [showAllExtra, setShowAllExtra] = useState(false);
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
  const hasExtraSection = extraItems.length > 0 || upcomingExtras.length > 0;
  const dailyCountdown = useMemo(
    () => formatCountdown(data?.upcoming.daily.closesAtMs ?? null, now),
    [data?.upcoming.daily.closesAtMs, now],
  );

  if (!hasTickets) {
    return (
      <NoTicketsState
        priceLabel={data?.upcoming.principal.priceLabel ?? "R$ 39,90"}
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
      <div className="relative w-full overflow-hidden rounded-b-[22px]">
        <Image
          src={bannerBoloes}
          alt="Banner — Bolões"
          className="h-auto w-full object-cover object-center"
          priority
          sizes="100vw"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent"
          aria-hidden
        />
      </div>
      <div className="mx-auto w-full max-w-[430px] px-4">
        <section
          className="grid grid-cols-2 gap-2"
          aria-label="Resumo dos bolões"
        >
          <SummaryCard
            icon={ClipboardList}
            label="Bolões ativos"
            value={String(summary.activeCount)}
            helper="Em andamento"
          />
          <SummaryCard
            icon={Trophy}
            label="Sua melhor posição"
            value={bestPosition}
            helper="Ranking"
            tone={GREEN_SOFT}
          />
        </section>

        {!ticketsExtraOnly && (
          <>
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
          </>
        )}

        <ComoFuncionaPalpitesCard />

        <header className="mt-6">
          <div className="flex items-start gap-3 sm:gap-3.5">
            <ChevronDown
              className="mt-0.5 size-6 shrink-0 sm:size-7"
              style={{ color: GREEN }}
              strokeWidth={2.75}
              aria-hidden
            />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <h2 className="text-[14px] font-black uppercase leading-none tracking-[-0.02em] text-white min-[380px]:text-[16px]">
                  Selecione seu bolão
                </h2>
              </div>
              <p className="text-[12px] font-normal leading-snug text-[#888888]">
                Escolha abaixo onde deseja palpitar
              </p>
            </div>
          </div>
        </header>

        {hasExtraSection && (
          <section className={ticketsExtraOnly ? "mt-6 mb-6" : "mt-4 mb-6"}>
            {(() => {
              const extraCollapsedCount =
                extraShowcaseItems.length > 0
                  ? extraShowcaseItems.length
                  : upcomingExtras.length;
              return showAllExtra ? (
                <div className="space-y-3">
                  {extraShowcaseItems.length > 0
                    ? extraShowcaseItems.map((item) => (
                        <ActiveShowcaseCard
                          key={item.id}
                          item={item}
                          now={now}
                          kind="extra"
                          fullWidth
                        />
                      ))
                    : upcomingExtras.map((ex) => (
                        <UpcomingExtraOfferCard
                          key={ex.championshipId}
                          ex={ex}
                          now={now}
                          fullWidth
                        />
                      ))}
                </div>
              ) : extraCollapsedCount <= 1 ? (
                extraShowcaseItems.length === 1 ? (
                  <ActiveShowcaseCard
                    key={extraShowcaseItems[0].id}
                    item={extraShowcaseItems[0]}
                    now={now}
                    kind="extra"
                    fullWidth
                  />
                ) : (
                  <UpcomingExtraOfferCard
                    ex={upcomingExtras[0]}
                    now={now}
                    fullWidth
                  />
                )
              ) : (
                <CarouselShell
                  tone={GREEN}
                  itemCount={extraCollapsedCount}
                >
                  {extraShowcaseItems.length > 0
                    ? extraShowcaseItems.map((item) => (
                        <ActiveShowcaseCard
                          key={item.id}
                          item={item}
                          now={now}
                          kind="extra"
                        />
                      ))
                    : upcomingExtras.map((ex) => (
                        <UpcomingExtraOfferCard
                          key={ex.championshipId}
                          ex={ex}
                          now={now}
                        />
                      ))}
                </CarouselShell>
              );
            })()}
          </section>
        )}

        <CotaCpa />
      </div>
    </div>
  );
}
