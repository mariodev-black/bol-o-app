"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import type { RankingScopeCardAction } from "@/app/(authenticated)/ranking/_components/ranking-flow";
import {
  RANKING_CARD_BG,
  RANKING_INK,
  RANKING_YELLOW,
  ScopeLogoLarge,
  scopeCardHeaderParts,
  scopeRoundLabel,
  scopeSelectLines,
  scopeStatusColor,
  scopePendingBarMessage,
  scopeStatusLabel,
  ScopeStatusIcon,
} from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";
import {
  palpitesHrefForScope,
  type RankingScopeOption,
} from "@/lib/ranking/scopes-shared";

const CAROUSEL_CARD_CLASS =
  "w-[368px] max-w-[88vw] shrink-0 snap-center";

export function RankingScopeCard({
  option,
  highlighted,
  action,
  carouselItem = false,
  onOpenRanking,
  onOpenSteps,
}: {
  option: RankingScopeOption;
  highlighted?: boolean;
  action: RankingScopeCardAction;
  /** Largura fixa dentro do carrossel horizontal (como /boloes). */
  carouselItem?: boolean;
  onOpenRanking: () => void;
  onOpenSteps?: () => void;
}) {
  const { primary, secondary } = scopeSelectLines(option);
  const header = scopeCardHeaderParts(option, primary);
  const statusLabel = scopeStatusLabel({
    status: option.status,
    statusLabel: option.statusLabel,
    palpitesSentCount: option.palpitesSentCount,
  });
  const statusColor = scopeStatusColor(option.status);
  const roundLabel = scopeRoundLabel(option);
  const pendingBarLine = scopePendingBarMessage({
    palpitesSentCount: option.palpitesSentCount ?? 0,
    pendingPalpitesCount: option.pendingPalpitesCount ?? 0,
  });
  const showPendingBar = pendingBarLine != null;
  const goToPalpites = action === "palpites";
  const href = palpitesHrefForScope(option);
  const layoutClass = carouselItem ? CAROUSEL_CARD_CLASS : "w-full";

  const cardStyle = {
    background: RANKING_CARD_BG,
    borderWidth: 1,
    borderStyle: "solid" as const,
    borderColor: highlighted
      ? "rgba(177,235,11,0.45)"
      : "rgba(255,255,255,0.1)",
    boxShadow: highlighted
      ? "0 0 0 1px rgba(177,235,11,0.2), 0 14px 40px rgba(0,0,0,0.5)"
      : "0 10px 32px rgba(0,0,0,0.42)",
  };

  const headerBlock = (
    <>
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <div className="flex w-[80px] shrink-0 items-center justify-center pt-0.5 min-[380px]:w-[88px]">
          <ScopeLogoLarge option={option} />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/65">
            {header.category}
          </p>
          <h3 className="mt-1 text-[22px] font-black uppercase leading-[1.05] tracking-[-0.02em] text-white min-[380px]:text-[24px]">
            {header.title}
          </h3>
          {roundLabel && roundLabel !== header.title ? (
            <p className="mt-2 text-[14px] font-black uppercase tracking-wide text-primary min-[380px]:text-[15px]">
              {roundLabel}
            </p>
          ) : null}
          {secondary ? (
            <p className="mt-2 text-[15px] font-semibold leading-snug text-white/75 min-[380px]:text-[16px]">
              {secondary}
            </p>
          ) : null}
        </div>
      </div>

      {showPendingBar ? (
        <div
          className="mx-4 flex items-center gap-2.5 rounded-lg border px-3 py-2.5"
          style={{
            borderColor: "rgba(230,183,38,0.45)",
            background: "rgba(230,183,38,0.12)",
          }}
        >
          <ClipboardList
            className="size-4 shrink-0"
            style={{ color: RANKING_YELLOW }}
            strokeWidth={2.25}
            aria-hidden
          />
          <p
            className="text-[12px] font-black uppercase leading-snug tracking-[0.02em] min-[380px]:text-[13px]"
            style={{ color: RANKING_YELLOW }}
          >
            {pendingBarLine}
          </p>
        </div>
      ) : (
        <div className="mx-4 flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
          <ScopeStatusIcon option={option} />
          <p
            className="text-[15px] font-black uppercase leading-tight tracking-[0.02em] min-[380px]:text-[16px]"
            style={{ color: statusColor }}
          >
            {statusLabel}
          </p>
        </div>
      )}
    </>
  );

  const ctaRanking = (
    <span
      className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[11px] bg-primary text-[16px] font-black uppercase tracking-[0.05em] transition-[filter] group-hover:brightness-105 min-[380px]:min-h-[54px] min-[380px]:text-[17px]"
      style={{ color: RANKING_INK }}
    >
      Ver classificação
      <ArrowRight className="size-4 shrink-0" strokeWidth={2.6} aria-hidden />
    </span>
  );

  const ctaPalpites = (
    <div className="space-y-2">
      <Link
        href={href}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[11px] bg-white text-[16px] font-black uppercase tracking-[0.05em] text-[#0E141B] transition hover:bg-white/92 active:scale-[0.98] min-[380px]:min-h-[54px] min-[380px]:text-[17px]"
      >
        Fazer palpites
        <ArrowRight className="size-4 shrink-0" strokeWidth={2.6} aria-hidden />
      </Link>
      {onOpenSteps ? (
        <button
          type="button"
          onClick={onOpenSteps}
          className="w-full min-h-[44px] py-2 text-[16px] font-semibold text-white/65 underline decoration-white/30 underline-offset-[6px] transition hover:text-white/90 min-[380px]:text-[17px]"
        >
          Ver passo a passo
        </button>
      ) : null}
    </div>
  );

  if (goToPalpites) {
    return (
      <article
        className={`flex flex-col overflow-hidden rounded-[16px] text-left ${layoutClass}`}
        style={cardStyle}
        aria-label={`${header.category} ${header.title}`}
      >
        {headerBlock}
        <div className="px-4 pb-4 pt-3">{ctaPalpites}</div>
      </article>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenRanking}
      aria-label={`Ver classificação: ${header.category} ${header.title}`}
      className={`group flex flex-col overflow-hidden rounded-[16px] text-left transition active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${layoutClass}`}
      style={cardStyle}
    >
      {headerBlock}
      <div className="px-4 pb-4 pt-3">{ctaRanking}</div>
    </button>
  );
}

export function RankingScopeGroupLabel({ children }: { children: string }) {
  return (
    <p className="mb-3 mt-7 first:mt-0 text-[14px] font-black uppercase tracking-[0.14em] text-primary">
      {children}
    </p>
  );
}
