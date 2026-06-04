"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, X } from "lucide-react";
import {
  PROMO_HUB_TABS,
  promoHubCardImage,
  type PromoHubTabId,
} from "@/lib/promotions/hub-cards";
import type {
  PromoHubItem,
  PromoHubLeagueRow,
  PromoHubResponse,
} from "@/lib/promotions/hub-shared";

function PromoHubLeagueList({ leagues }: { leagues: PromoHubLeagueRow[] }) {
  if (leagues.length === 0) return null;

  return (
    <ul className="mt-3 overflow-hidden rounded-xl border border-white/8 bg-[#141414]">
      {leagues.map((league, index) => (
        <li
          key={`${league.displayName}-${league.rodadaNome}`}
          className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
            index > 0 ? "border-t border-white/8" : ""
          }`}
        >
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold uppercase leading-tight text-white">
              {league.displayName}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium leading-snug text-white/45">
              {league.rodadaNome}
            </p>
          </div>
          {league.alreadyClaimed ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
              <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
              Resgatada
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Disponível
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function PromoHubCard({
  item,
  onActivate,
}: {
  item: PromoHubItem;
  onActivate: (item: PromoHubItem) => void;
}) {
  const image = promoHubCardImage(item.id);
  const disabled = !item.actionable;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onActivate(item)}
      className="group block w-full overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] text-left disabled:cursor-not-allowed disabled:opacity-55"
      aria-label={`${item.title}. ${item.ctaLabel}`}
    >
      <div className="relative aspect-[2.4/1] w-full overflow-hidden bg-[#222]">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 480px"
          className="object-cover object-top opacity-90"
          draggable={false}
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/15 via-black/25 to-[#1a1a1a]" />

        {item.tag ? (
          <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/85">
            {item.tag}
          </span>
        ) : null}

        {item.highlight ? (
          <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#0E141B]">
            Novo
          </span>
        ) : item.state === "done" ? (
          <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/70">
            Concluída
          </span>
        ) : null}
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="text-[15px] font-black uppercase leading-tight tracking-tight text-white">
          {item.title}
        </p>
        <p className="mt-1 text-[12px] font-medium leading-snug text-white/55">
          {item.description}
        </p>

        {item.leagues?.length ? (
          <PromoHubLeagueList leagues={item.leagues} />
        ) : null}

        <span className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[11px] font-black uppercase tracking-wide text-[#0E141B]">
          {item.ctaLabel}
          <ChevronRight
            className="size-3.5 opacity-70"
            strokeWidth={2.5}
            aria-hidden
          />
        </span>
      </div>
    </button>
  );
}

function PromoHubTabs({
  activeTab,
  onTabChange,
  counts,
}: {
  activeTab: PromoHubTabId;
  onTabChange: (tab: PromoHubTabId) => void;
  counts: Record<PromoHubTabId, number>;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {PROMO_HUB_TABS.map((tab) => {
        const active = activeTab === tab.id;
        const count = counts[tab.id] ?? 0;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-black uppercase tracking-wide transition ${
              active
                ? "bg-primary text-[#0E141B]"
                : "bg-[#2a2a2a] text-white/70 hover:bg-[#333] hover:text-white"
            }`}
          >
            {tab.label} ({count})
          </button>
        );
      })}
    </div>
  );
}

export function PromotionsBottomSheet({
  open,
  onClose,
  loading,
  error,
  data,
  onActivate,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: PromoHubResponse | null;
  onActivate: (item: PromoHubItem) => void;
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [activeTab, setActiveTab] = useState<PromoHubTabId>("all");

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveTab("all");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      all: items.length,
      brindes: items.filter((i) => i.category === "brindes").length,
      palpite: items.filter((i) => i.category === "palpite").length,
    } satisfies Record<PromoHubTabId, number>;
  }, [data?.items]);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    if (activeTab === "all") return items;
    return items.filter((item) => item.category === activeTab);
  }, [activeTab, data?.items]);

  if (!open || !portalReady) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-120 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotions-sheet-title"
    >
      <button
        type="button"
        className="animate-perfil-avatar-overlay-in absolute inset-0 z-0 bg-black/78 backdrop-blur-[2px]"
        aria-label="Fechar promoções"
        onClick={onClose}
      />

      <div className="animate-perfil-avatar-sheet-in relative z-10 flex max-h-[min(88dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-[#141414] shadow-[0_-16px_56px_rgba(0,0,0,0.65)] sm:max-h-[min(85vh,720px)] sm:rounded-[22px] sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-4">
          <h2
            id="promotions-sheet-title"
            className="text-[18px] font-black uppercase tracking-wide text-white"
          >
            Promoções
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-[#222] text-white/80 transition hover:bg-[#2a2a2a] hover:text-white"
            aria-label="Fechar promoções"
          >
            <X className="size-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="shrink-0 px-4 pb-3">
          <PromoHubTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={counts}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {loading ? (
            <div className="space-y-3 pb-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-white/8 bg-[#1a1a1a]"
                >
                  <div className="aspect-[2.4/1] animate-pulse bg-white/6" />
                  <div className="space-y-2 px-4 py-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-white/8" />
                    <div className="h-3 w-full animate-pulse rounded bg-white/6" />
                    <div className="h-10 animate-pulse rounded-full bg-white/8" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-[13px] text-white/55">{error}</p>
          ) : filteredItems.length === 0 ? (
            <p className="py-10 text-center text-[13px] leading-snug text-white/45">
              Nenhuma promoção nesta categoria.
            </p>
          ) : (
            <ul className="space-y-3 pb-2">
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <PromoHubCard item={item} onActivate={onActivate} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
