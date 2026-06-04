"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gift } from "lucide-react";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { PromotionsBottomSheet } from "@/app/shared/PromotionsBottomSheet";
import { usePromotionsHub } from "@/app/shared/PromotionsHubContext";
import type { PromoHubItem, PromoHubResponse } from "@/lib/promotions/hub-shared";

export function PromotionsGiftButton({
  variant,
}: {
  variant: "mobile" | "desktop";
}) {
  const toast = useBolaoToast();
  const { openPromotion, setPromotionPrefetch } = usePromotionsHub();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PromoHubResponse | null>(null);
  const [highlightCount, setHighlightCount] = useState(0);
  const fetchGenRef = useRef(0);

  const fetchHub = useCallback(async (opts?: { silent?: boolean }) => {
    const gen = ++fetchGenRef.current;
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const r = await fetch("/api/promotions/hub", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await r.json().catch(() => ({}))) as PromoHubResponse & {
        error?: string;
      };
      if (gen !== fetchGenRef.current) return;
      if (!r.ok) {
        throw new Error(json.error ?? "Falha ao carregar");
      }
      setData(json);
      setHighlightCount(json.highlightCount ?? 0);
    } catch (e) {
      if (gen !== fetchGenRef.current) return;
      if (!opts?.silent) {
        setError(e instanceof Error ? e.message : "Erro ao carregar");
        setData(null);
        setHighlightCount(0);
      }
    } finally {
      if (gen === fetchGenRef.current && !opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchHub();
  }, [fetchHub]);

  useEffect(() => {
    let cancelled = false;
    const prefetchPromotions = async () => {
      const [extraRes, egitoRes] = await Promise.all([
        fetch("/api/promotions/extra-gift", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/promotions/brasil-egito-placar", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      if (cancelled) return;
      if (extraRes.ok) {
        setPromotionPrefetch("extra_gift", await extraRes.json());
      }
      if (egitoRes.ok) {
        setPromotionPrefetch("brasil_egito_placar", await egitoRes.json());
      }
    };
    void prefetchPromotions();
    return () => {
      cancelled = true;
    };
  }, [setPromotionPrefetch]);

  useEffect(() => {
    if (open) void fetchHub({ silent: Boolean(data) });
  }, [open, fetchHub, data]);

  const handleActivate = useCallback(
    (item: PromoHubItem) => {
      if (!item.actionable) return;
      setOpen(false);
      const ok = openPromotion(item.id);
      if (!ok) {
        toast.error("Não foi possível abrir esta promoção agora.");
      }
    },
    [openPromotion, toast],
  );

  const showNovoBadge = highlightCount > 0;
  const showAnimatedBorder = true;
  const wrapClass = showAnimatedBorder
    ? "promo-gift-trigger-wrap promo-gift-trigger-wrap--live"
    : "promo-gift-trigger-wrap promo-gift-trigger-wrap--idle";

  return (
    <>
      <div className={wrapClass}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="promo-gift-trigger-btn"
          aria-label="Promoções"
          aria-expanded={open}
        >
          {showNovoBadge ? (
            <span className="pointer-events-none absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-black uppercase leading-none tracking-wide text-[#0E141B]">
              Novo
            </span>
          ) : null}
          <Gift
            className="relative z-1 size-5 text-primary"
            strokeWidth={2}
          />
        </button>
      </div>

      <PromotionsBottomSheet
        open={open}
        onClose={() => setOpen(false)}
        loading={loading}
        error={error}
        data={data}
        onActivate={handleActivate}
      />
    </>
  );
}
