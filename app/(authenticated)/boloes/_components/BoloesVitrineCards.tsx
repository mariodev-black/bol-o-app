"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Flag,
  LineChart,
  MoveHorizontal,
  Radio,
  Star,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import iconeBolaoArtilheiro from "@/app/assets/icone-bolao-artilheiro.png";
import iconCopaMundo from "@/app/assets/icon-copa-mundo.png";
import logoBolaoDiario from "@/app/assets/logo-bolao-diario.png";
import skaleLogo from "@/app/assets/skale.png";
import iconCopaMundo2 from "@/app/assets/icon-copa-mundo2.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import { useMainBolaoPromoModal } from "@/app/shared/MainBolaoPromoContext";
import { extraBolaoIconSrc } from "@/app/shared/extra-bolao-icons";
import { getExtraBolaoHeroSideVariant } from "@/lib/boloes-extra-competition-branding";
import type { ActiveBolaoListItem } from "@/app/(authenticated)/boloes/BoloesClient";
import { ARTILHEIROS_BOLAO_SUBTITLE, ARTILHEIROS_BOLAO_TITLE } from "@/lib/artilheiros/config";
import { formatParticipantsShort } from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";

const GREEN = "#B1EB0B";
const GREEN_SOFT = "#0AC96B";
const CARD_INNER = "#111111";

const CAROUSEL_CARD_W =
  "w-[min(340px,calc(100vw-2.5rem))] shrink-0 flex-none snap-center";

const MILHAO_CARD_CLASS =
  "overflow-hidden rounded-[16px] bg-[#0000] shadow-[0_18px_52px_rgba(0,0,0,0.55)] border border-[#1B1D1C]";
  const MILHAO_CARD_INNER_CLASS =
  "overflow-hidden rounded-[16px] bg-[#0000] shadow-[0_18px_52px_rgba(0,0,0,0.55)] border border-[#1B1D1C]";
function MiniSoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.25" fill="#f4f4f5" stroke="#18181b" strokeWidth="0.65" />
      <path
        fill="#18181b"
        d="M12 6.35 14.42 8.12v3.52L12 13.65 9.58 11.64V8.12L12 6.35zm-5.9 2.78 2.95 1.05v4.64l-2.95 1.05-1.82-3.37 1.82-3.37zm11.8 0 1.82 3.37-1.82 3.37-2.95-1.05v-4.64l2.95-1.05z"
      />
    </svg>
  );
}

function cotaBadge(label: string | undefined): string {
  const hashMatch = String(label ?? "").match(/#\s*(\d+)/);
  if (hashMatch?.[1]) return hashMatch[1].padStart(2, "0");
  return "01";
}

function CotaBadgePill({ cotaLabel }: { cotaLabel: string }) {
  return (
    <span className="absolute right-4 top-4 rounded-[5px] border border-white/10 bg-[#161616] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-white/90">
      COTA {cotaBadge(cotaLabel)}
    </span>
  );
}

function MilhaoPrincipalHeader({
  cotaLabel,
}: {
  cotaLabel?: string | null;
}) {
  return (
    <div className="relative px-4 pb-3 pt-4">
      {cotaLabel ? <CotaBadgePill cotaLabel={cotaLabel} /> : null}

      <div
        className={[
          "flex items-start gap-2.5 min-[360px]:gap-3",
          cotaLabel ? "pr-[72px]" : "",
        ].join(" ")}
      >
        <div className="flex w-[78px] shrink-0 items-center justify-center min-[360px]:w-[88px]">
          <Image
            src={iconCopaMundo2}
            alt=""
            width={88}
            height={118}
            className="h-[108px] w-[72px] object-contain object-center min-[360px]:h-[118px] min-[360px]:w-[80px]"
            priority
          />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-[19px] font-black uppercase leading-[0.92] tracking-[-0.02em] text-white min-[360px]:text-[21px]">
            Bolão do Milhão
          </h2>
          <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.05em] text-white/92 min-[360px]:text-[13px]">
            Copa do Mundo 2026
          </p>
          <p className="mt-2.5 text-[28px] font-black uppercase leading-none tracking-[-0.03em] text-primary min-[360px]:text-[30px]">
            + DE 1 MILHÃO
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/78 min-[360px]:text-[12px]">
            EM PREMIAÇÕES
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-[#111111] px-3.5 py-2">
        <Trophy
          className="size-4 shrink-0 text-white/85"
          strokeWidth={2.1}
          aria-hidden
        />
        <p className="text-[14px] font-bold uppercase tracking-[0.05em] text-white/88">
          Primeiro lugar ganha{" "}
          <span className="font-black text-primary">180 MIL</span>
        </p>
      </div>
    </div>
  );
}

function artilheirosRemainingPicks(item: ActiveBolaoListItem): number {
  return Math.max(0, (item.total ?? 3) - (item.sent ?? 0));
}

function artilheiroStatusColumnMeta(item: ActiveBolaoListItem): {
  headline: string;
  subtext: string;
  tone: string;
  Icon: typeof Activity;
} {
  switch (item.displayPhase) {
    case "pendentes":
      return {
        headline: "Aberto",
        subtext: "escolha agora",
        tone: GREEN,
        Icon: ClipboardList,
      };
    case "enviados":
      return {
        headline: "Enviado",
        subtext: "aguardando copa",
        tone: GREEN_SOFT,
        Icon: CheckCircle2,
      };
    default:
      return {
        headline: "Encerrado",
        subtext: item.points > 0 ? `${item.points} pts` : "resultado final",
        tone: "#E6B726",
        Icon: Flag,
      };
  }
}

function ArtilheirosOwnedStatsGrid({
  item,
  compact = false,
}: {
  item: ActiveBolaoListItem;
  compact?: boolean;
}) {
  const remaining = artilheirosRemainingPicks(item);
  const participants = item.participantCount ?? 0;
  const showRanking = item.displayPhase === "finalizado";
  const position = showRanking && item.position != null ? `${item.position}º` : "—";
  const status = artilheiroStatusColumnMeta(item);
  const StatusIcon = status.Icon;
  const valueClass = compact
    ? "mt-1 text-[18px] font-black leading-none text-primary min-[360px]:text-[20px]"
    : "mt-1 text-[22px] font-black leading-none text-primary min-[360px]:text-[24px]";
  const labelClass = compact
    ? "mt-1.5 text-[8px] font-medium leading-tight text-white/38 min-[360px]:text-[9px]"
    : "mt-1.5 px-0.5 text-[9px] font-medium leading-tight text-white/38 min-[360px]:text-[10px]";
  const headlineClass = compact
    ? "mt-1 text-[11px] font-black uppercase leading-tight tracking-[0.02em] min-[360px]:text-[12px]"
    : "mt-1 text-[13px] font-black uppercase leading-tight tracking-[0.02em] min-[360px]:text-[14px]";

  return (
    <div className="grid grid-cols-3">
      <div className="min-w-0 px-1 text-center">
        <LineChart
          className="mx-auto size-[16px] text-primary min-[360px]:size-[18px]"
          strokeWidth={2.35}
          aria-hidden
        />
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.07em] text-white/88 min-[360px]:text-[9px]">
          Sua posição
        </p>
        <p className={valueClass}>{position}</p>
        {showRanking && participants > 0 ? (
          <p className={labelClass}>
            Entre {formatParticipantsShort(participants)} participantes
          </p>
        ) : (
          <p className={labelClass}>após resultado oficial</p>
        )}
      </div>

      <div className="min-w-0 border-x border-white/[0.07] px-1 text-center">
        <Users
          className="mx-auto size-[16px] text-primary min-[360px]:size-[18px]"
          strokeWidth={2.35}
          aria-hidden
        />
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.07em] text-white/88 min-[360px]:text-[9px]">
          Restantes
        </p>
        <p className={valueClass}>{remaining}</p>
        <p className={labelClass}>
          {remaining > 0 ? "para escolher" : "palpite completo"}
        </p>
      </div>

      <div className="min-w-0 px-1 text-center">
        <div className="relative mx-auto flex size-[22px] items-center justify-center">
          <StatusIcon
            className="size-[16px] min-[360px]:size-[18px]"
            style={{ color: status.tone }}
            strokeWidth={2.35}
            aria-hidden
          />
        </div>
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.07em] text-white/88 min-[360px]:text-[9px]">
          Status
        </p>
        <p className={headlineClass} style={{ color: status.tone }}>
          {status.headline}
        </p>
        <p className={labelClass}>{status.subtext}</p>
      </div>
    </div>
  );
}

function bolaoStatusColumnMeta(item: ActiveBolaoListItem): {
  headline: string;
  subtext: string;
  tone: string;
  Icon: typeof Activity;
  live?: boolean;
} {
  switch (item.displayPhase) {
    case "disputa":
      return {
        headline: "Ao vivo",
        subtext: "jogo em andamento",
        tone: GREEN,
        Icon: Radio,
        live: true,
      };
    case "pendentes":
      return {
        headline: "Aberto",
        subtext: "palpite agora",
        tone: GREEN,
        Icon: ClipboardList,
      };
    case "enviados":
      return {
        headline: "Enviado",
        subtext: "aguardando jogos",
        tone: GREEN_SOFT,
        Icon: CheckCircle2,
      };
    default:
      return {
        headline: "Encerrado",
        subtext: "rodada finalizada",
        tone: "#E6B726",
        Icon: Flag,
      };
  }
}

function BolaoStatusColumn({
  item,
  compact = false,
}: {
  item: ActiveBolaoListItem;
  compact?: boolean;
}) {
  const status = bolaoStatusColumnMeta(item);
  const StatusIcon = status.Icon;
  const headlineClass = compact
    ? "mt-1 text-[11px] font-black uppercase leading-tight tracking-[0.02em] min-[360px]:text-[12px]"
    : "mt-1 text-[13px] font-black uppercase leading-tight tracking-[0.02em] min-[360px]:text-[14px]";
  const subtextClass = compact
    ? "mt-1.5 text-[8px] font-medium leading-tight text-white/38 min-[360px]:text-[9px]"
    : "mt-1.5 text-[9px] font-medium leading-tight text-white/38 min-[360px]:text-[10px]";

  return (
    <div className="min-w-0 px-1 text-center">
      <div className="relative mx-auto flex size-[22px] items-center justify-center">
        {status.live ? (
          <span
            className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary animate-pulse"
            aria-hidden
          />
        ) : null}
        <StatusIcon
          className="size-[16px] min-[360px]:size-[18px]"
          style={{ color: status.tone }}
          strokeWidth={2.35}
          aria-hidden
        />
      </div>
      <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.07em] text-white/88 min-[360px]:text-[9px]">
        Status
      </p>
      <p className={headlineClass} style={{ color: status.tone }}>
        {status.headline}
      </p>
      <p className={subtextClass}>{status.subtext}</p>
    </div>
  );
}

function MilhaoOwnedStatsGrid({
  item,
  compact = false,
}: {
  item: ActiveBolaoListItem;
  compact?: boolean;
}) {
  const remaining = remainingGames(item);
  const participants = item.participantCount ?? 0;
  const position = item.position != null ? `${item.position}º` : "—";
  const valueClass = compact
    ? "mt-1 text-[18px] font-black leading-none text-primary min-[360px]:text-[20px]"
    : "mt-1 text-[22px] font-black leading-none text-primary min-[360px]:text-[24px]";
  const labelClass = compact
    ? "mt-1.5 text-[8px] font-medium leading-tight text-white/38 min-[360px]:text-[9px]"
    : "mt-1.5 px-0.5 text-[9px] font-medium leading-tight text-white/38 min-[360px]:text-[10px]";

  return (
    <div className="grid grid-cols-3">
      <div className="min-w-0 px-1 text-center">
        <LineChart
          className="mx-auto size-[16px] text-primary min-[360px]:size-[18px]"
          strokeWidth={2.35}
          aria-hidden
        />
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.07em] text-white/88 min-[360px]:text-[9px]">
          Sua posição
        </p>
        <p className={valueClass}>{position}</p>
        {participants > 0 ? (
          <p className={labelClass}>
            Entre {participants.toLocaleString("pt-BR")} participantes
          </p>
        ) : null}
      </div>

      <div className="min-w-0 border-x border-white/[0.07] px-1 text-center">
        <MiniSoccerBallIcon className="mx-auto size-[16px] min-[360px]:size-[18px]" />
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.07em] text-white/88 min-[360px]:text-[9px]">
          Jogos restantes
        </p>
        <p className={valueClass}>{remaining}</p>
        <p className={labelClass}>para você palpitar</p>
      </div>

      <BolaoStatusColumn item={item} compact={compact} />
    </div>
  );
}

function MilhaoPurchaseStatsGrid({
  participantCount,
  priceLabel,
}: {
  participantCount: number;
  priceLabel: string;
}) {
  const participantsLabel =
    participantCount > 0
      ? participantCount.toLocaleString("pt-BR")
      : "—";

  return (
    <div className="grid grid-cols-3">
      <div className="min-w-0 px-1 text-center">
        <LineChart
          className="mx-auto size-[16px] text-primary min-[360px]:size-[18px]"
          strokeWidth={2.35}
          aria-hidden
        />
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.07em] text-white/88 min-[360px]:text-[9px]">
          Participantes
        </p>
        <p className="mt-1 text-[18px] font-black leading-none text-primary min-[360px]:text-[20px]">
          {participantsLabel}
        </p>
        <p className="mt-1.5 text-[8px] font-medium leading-tight text-white/38 min-[360px]:text-[9px]">
          no campeonato
        </p>
      </div>

      <div className="min-w-0 border-x border-white/[0.07] px-1 text-center">
        <Trophy
          className="mx-auto size-[16px] text-primary min-[360px]:size-[18px]"
          strokeWidth={2.35}
          aria-hidden
        />
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.07em] text-white/88 min-[360px]:text-[9px]">
          Premiação
        </p>
        <p className="mt-1 text-[14px] font-black uppercase leading-none text-primary min-[360px]:text-[15px]">
          1 MILHÃO
        </p>
        <p className="mt-1.5 text-[8px] font-medium leading-tight text-white/38 min-[360px]:text-[9px]">
          em prêmios
        </p>
      </div>

      <div className="min-w-0 px-1 text-center">
        <Activity
          className="mx-auto size-[16px] text-primary min-[360px]:size-[18px]"
          strokeWidth={2.35}
          aria-hidden
        />
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.07em] text-white/88 min-[360px]:text-[9px]">
          Sua cota
        </p>
        <p className="mt-1 text-[11px] font-black uppercase leading-tight text-primary min-[360px]:text-[12px]">
          {priceLabel}
        </p>
        <p className="mt-1.5 text-[8px] font-medium leading-tight text-white/38 min-[360px]:text-[9px]">
          via PIX
        </p>
      </div>
    </div>
  );
}

/** Caixa interna escura: stats + botão agrupados (como na referência). */
function CardActionFoot({
  children,
  href,
  label,
  promoIntercept,
  helperText,
}: {
  children: React.ReactNode;
  href: string;
  label: string;
  promoIntercept?: boolean;
  helperText?: string;
}) {
  return (
    <div className="mx-2 mb-2 rounded-[14px] border border-[#1B1D1C] bg-[#111111] px-2.5 pb-2.5 pt-3.5">
      {children}
      {helperText ? (
        <p className="mt-2.5 px-1 text-center text-[11px] font-medium leading-snug text-white/45">
          {helperText}
        </p>
      ) : null}
      <div className={helperText ? "mt-2.5 px-1" : "mt-3 px-1"}>
        <MilhaoCardCta href={href} label={label} promoIntercept={promoIntercept} />
      </div>
    </div>
  );
}

function MilhaoCardCta({
  href,
  label,
  promoIntercept,
}: {
  href: string;
  label: string;
  promoIntercept?: boolean;
}) {
  const router = useRouter();
  const { requestModal } = useMainBolaoPromoModal();

  const className =
    "flex h-[40px] w-full items-center justify-center rounded-[10px] bg-primary text-[13px] font-black uppercase tracking-[0.06em] text-black transition-[filter] hover:brightness-105 active:scale-[0.98] min-[380px]:h-[42px] min-[380px]:text-[14px]";

  if (promoIntercept) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          router.push(href);
          requestModal();
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function milhaoPrincipalCta(item: ActiveBolaoListItem): string {
  if (item.displayPhase === "pendentes") return "Fazer palpites";
  return "Ver palpites";
}

function remainingGames(item: ActiveBolaoListItem): number {
  if (item.displayPhase === "finalizado") return 0;
  if (item.type === "artilheiros") {
    return Math.max(0, (item.total ?? 3) - (item.sent ?? 0));
  }
  if (item.type === "principal") {
    return Math.max(0, (item.total ?? 0) - (item.sent ?? 0));
  }
  return Math.max(0, item.gamesCount ?? 0);
}

function positionDisplay(position: number | null): string {
  if (position == null) return "—";
  return `${position}º`;
}

function resolveCta(item: ActiveBolaoListItem, now: number): string {
  const isGratisExtra = item.type === "extra" && item.isPromoBonus !== false;
  const showVerResultados =
    item.displayPhase === "finalizado" ||
    item.displayPhase === "disputa" ||
    (item.displayPhase === "enviados" &&
      item.countdownTargetMs != null &&
      now >= item.countdownTargetMs);

  if (item.type === "principal") {
    return item.displayPhase === "pendentes" ? "Fazer palpites" : "Ver palpites";
  }
  if (item.type === "artilheiros") {
    const sent = item.sent ?? 0;
    if (item.displayPhase === "pendentes") {
      return sent > 0 ? "Continuar palpite" : "Escolher artilheiros";
    }
    return "Ver palpites";
  }
  if (isGratisExtra) {
    return item.displayPhase === "pendentes"
      ? "Fazer palpites"
      : showVerResultados
        ? "Ver resultados"
        : "Ver palpites";
  }
  return item.displayPhase === "pendentes"
    ? "Fazer palpites"
    : showVerResultados
      ? "Ver classificação"
      : "Ver classificação";
}

function logoForItem(item: ActiveBolaoListItem) {
  if (item.type === "diario") {
    return item.isSkaleDaily ? skaleLogo : logoBolaoDiario;
  }
  if (item.type === "artilheiros") return iconeBolaoArtilheiro;
  if (item.type === "principal") return iconCopaMundo;
  const variant = getExtraBolaoHeroSideVariant(item.championshipId, item.title);
  return variant === "generic" ? ticketBlue : extraBolaoIconSrc(variant);
}

function parseExtraTitle(title: string): { name: string; round: string | null } {
  const t = title.trim();
  if (!t.includes(" · ")) return { name: t, round: null };
  const [name, round] = t.split(" · ", 2);
  return { name: (name ?? t).trim(), round: round?.trim() || null };
}

function cardTitleParts(item: ActiveBolaoListItem): {
  eyebrow: string;
  title: string;
  subtitle: string | null;
} {
  if (item.type === "principal") {
    return {
      eyebrow: "Bolão do Milhão",
      title: "Copa do Mundo 2026",
      subtitle: "+ de 1 milhão em premiações",
    };
  }
  if (item.type === "diario") {
    return {
      eyebrow: item.title || (item.isSkaleDaily ? "Bolão Diário Skale" : "Bolão Diário"),
      title: item.dailyEditionDatesLabel?.trim() || "Rodada do dia",
      subtitle: null,
    };
  }
  if (item.type === "artilheiros") {
    return {
      eyebrow: item.title || ARTILHEIROS_BOLAO_TITLE,
      title: item.subtitle?.trim() || ARTILHEIROS_BOLAO_SUBTITLE,
      subtitle: null,
    };
  }
  if (item.type === "extra") {
    const { name } = parseExtraTitle(item.title);
    const round = item.extraRoundLabel?.trim() || parseExtraTitle(item.title).round;
    return { eyebrow: name, title: round ?? name, subtitle: round ? name : null };
  }
  const { name, round } = parseExtraTitle(item.title);
  return { eyebrow: name, title: round ?? name, subtitle: round ? name : null };
}
export function BoloesCarouselShell({
  children,
  itemCount,
}: {
  children: React.ReactNode;
  itemCount: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const showDots = itemCount > 1;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !showDots) return;
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
  }, [itemCount, showDots]);

  return (
    <div>
      {showDots ? (
        <div className="mb-3 flex items-center justify-center gap-2" aria-hidden>
          <ChevronRight className="size-4 rotate-180 text-primary/45" strokeWidth={2.5} />
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5">
            <MoveHorizontal className="size-4 animate-pulse text-primary" strokeWidth={2.35} />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
              Deslize
            </span>
          </span>
          <ChevronRight className="size-4 text-primary/45" strokeWidth={2.5} />
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Carrossel de bolões — deslize para o lado"
      >
        {children}
      </div>

      {showDots ? (
        <div className="mt-3 flex justify-center gap-1.5">
          {Array.from({ length: itemCount }, (_, i) => (
            <span
              key={i}
              className={
                i === activeIdx
                  ? "h-1.5 w-6 shrink-0 rounded-full bg-primary transition-[width] duration-300"
                  : "size-1.5 shrink-0 rounded-full bg-white/20"
              }
              aria-hidden
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PrincipalHeroPurchaseCard({
  href,
  priceLabel,
  participantCount,
  carouselItem = false,
}: {
  href: string;
  priceLabel: string;
  participantCount: number;
  carouselItem?: boolean;
}) {
  const layoutClass = carouselItem ? CAROUSEL_CARD_W : "w-full";

  return (
    <article className={`${MILHAO_CARD_INNER_CLASS} ${layoutClass}`}>
      <MilhaoPrincipalHeader />
      <CardActionFoot
        href={href}
        label={`Participar Agora`}
        helperText="Compre sua cota e dispute o prêmio milionário da Copa 2026."
      >
        <MilhaoPurchaseStatsGrid
          participantCount={participantCount}
          priceLabel={priceLabel}
        />
      </CardActionFoot>
    </article>
  );
}

export function PrincipalHeroCard({
  item,
  carouselItem = false,
}: {
  item: ActiveBolaoListItem;
  now?: number;
  carouselItem?: boolean;
}) {
  const cta = milhaoPrincipalCta(item);
  const layoutClass = carouselItem ? CAROUSEL_CARD_W : "w-full";

  return (
    <article className={`${MILHAO_CARD_CLASS} ${layoutClass}`}>
      <MilhaoPrincipalHeader cotaLabel={item.cotaLabel} />
      <CardActionFoot href={item.href} label={cta}>
        <MilhaoOwnedStatsGrid item={item} />
      </CardActionFoot>
    </article>
  );
}

export function ActiveBolaoCarouselCard({
  item,
  now,
  fullWidth = false,
}: {
  item: ActiveBolaoListItem;
  now: number;
  fullWidth?: boolean;
}) {
  const parts = cardTitleParts(item);
  const logo = logoForItem(item);
  const cta = resolveCta(item, now);
  const isGratisExtra = item.type === "extra" && item.isPromoBonus !== false;
  const subtitleLine =
    item.type === "extra"
      ? item.extraRoundLabel?.trim() || parseExtraTitle(item.title).round
      : item.type === "diario" || item.type === "artilheiros"
        ? parts.title
        : null;

  return (
    <article
      className={[
        MILHAO_CARD_CLASS,
        fullWidth ? "w-full" : CAROUSEL_CARD_W,
      ].join(" ")}
    >
      <div className="relative px-4 pb-3 pt-4">
        <CotaBadgePill cotaLabel={item.cotaLabel} />

        <div className="flex items-start gap-3 pr-[72px]">
          <div className="flex w-[64px] shrink-0 items-center justify-center min-[360px]:w-[72px]">
            <Image
              src={logo}
              alt=""
              width={72}
              height={72}
              className="h-[58px] w-auto max-w-[64px] object-contain min-[360px]:h-[64px] min-[360px]:max-w-[72px]"
            />
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="text-[17px] font-black uppercase leading-[1.02] tracking-[-0.02em] text-white min-[360px]:text-[18px]">
              {parts.eyebrow}
            </h3>
            {subtitleLine ? (
              <p className="mt-1 text-[12px] font-medium text-white/48">
                {subtitleLine}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <CardActionFoot
        href={item.href}
        label={cta}
        promoIntercept={isGratisExtra}
      >
        {item.type === "artilheiros" ? (
          <ArtilheirosOwnedStatsGrid item={item} compact />
        ) : (
          <MilhaoOwnedStatsGrid item={item} compact />
        )}
      </CardActionFoot>
    </article>
  );
}

export function FinishedBolaoChip({
  item,
}: {
  item: ActiveBolaoListItem;
}) {
  const parts = cardTitleParts(item);
  const logo = logoForItem(item);

  return (
    <Link
      href={item.href}
      className="flex w-[min(280px,calc(100vw-3rem))] border-2 border-[#1B1D1C] shrink-0 flex-none snap-start items-center gap-3 rounded-[14px] px-3 py-3 transition-colors hover:border-white/14 active:scale-[0.98]"
      style={{ background: CARD_INNER }}
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
        <Image
          src={logo}
          alt=""
          width={44}
          height={44}
          className="h-10 w-auto max-w-[44px] object-contain"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black uppercase leading-tight text-white">
          {parts.eyebrow}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-white/50">
          {parts.title}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[9px] font-black uppercase tracking-[0.08em] text-white/45">
          Sua posição
        </p>
        <p className="mt-0.5 text-[18px] font-black leading-none text-primary">
          {item.position != null ? `#${item.position}` : "—"}
        </p>
      </div>
    </Link>
  );
}

export function MilhaoUpsellBanner({ href }: { href: string }) {
  return (
    <aside
      className="mt-8 overflow-hidden rounded-[16px] border border-primary/25 bg-gradient-to-r from-[#1a2208] via-[#111111] to-[#111111] px-4 py-4"
      aria-label="Comprar mais cotas"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Trophy className="size-5 text-primary" strokeWidth={2.2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black uppercase leading-tight text-white">
            Fique mais perto do{" "}
            <span className="text-primary">Milhão</span>
          </p>
          <p className="mt-1 text-[12px] font-medium leading-snug text-white/55">
            Mais cotas = mais chances de levar o prêmio milionário.
          </p>
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-[10px] bg-primary px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.04em] text-[#0E141B] transition-[filter] hover:brightness-105 active:scale-[0.97] min-[380px]:px-4 min-[380px]:text-[12px]"
        >
          Comprar agora
        </Link>
      </div>
    </aside>
  );
}

export function BoloesPageEyebrow() {
  return (
    <header className="flex items-center gap-2 pt-1">
      <Target className="size-4 shrink-0 text-white" strokeWidth={2.4} aria-hidden />
      <p className="text-[12px] font-black uppercase tracking-[0.22em] text-white">
        Rumo ao Milhão
      </p>
    </header>
  );
}

export function BoloesSectionHeader({
  title,
  href,
  onVerTodos,
  icon,
}: {
  title: string;
  href?: string;
  onVerTodos?: () => void;
  icon?: React.ReactNode;
}) {
  const verTodosClassName =
    "inline-flex shrink-0 items-center gap-0.5 text-[12px] font-black uppercase tracking-wide text-primary transition-opacity hover:opacity-90";

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2
        id={
          title.toLowerCase().includes("ativos")
            ? "boloes-ativos-heading"
            : title.toLowerCase().includes("finalizados")
              ? "boloes-finalizados-heading"
              : undefined
        }
        className="flex items-center gap-2 text-[15px] font-black uppercase tracking-[0.04em] text-white min-[380px]:text-[16px]"
      >
        {icon}
        {title}
      </h2>
      {onVerTodos ? (
        <button type="button" onClick={onVerTodos} className={verTodosClassName}>
          Ver todos
          <ChevronRight className="size-3.5" strokeWidth={2.6} aria-hidden />
        </button>
      ) : href ? (
        <Link href={href} className={verTodosClassName}>
          Ver todos
          <ChevronRight className="size-3.5" strokeWidth={2.6} aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
