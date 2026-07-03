"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BolaoDefinitionCatalogItem } from "@/lib/boloes/definitions/types";
import { UpcomingBolaoCard } from "@/app/components/UpcomingBolaoCard";

const GREEN = "#B1EB0B";
const INTERVAL_MS = 4500;
const CARD_W = "w-[min(300px,calc(100vw-3rem))] shrink-0 flex-none";

export function ProximosBolaoCarousel({ className = "" }: { className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<BolaoDefinitionCatalogItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bolões que ainda não começaram (lifecycleStatus === 'programado'), do motor v2.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/boloes/catalog?section=upcoming", { cache: "no-store" });
        const d = (await r.json()) as { items?: BolaoDefinitionCatalogItem[] };
        if (cancelled) return;
        setItems(d.items ?? []);
      } catch {
        /* mantém vazio — seção fica oculta */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  const scrollCards = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const firstCard = el.querySelector("[data-card]") as HTMLElement | null;
    const cardW = firstCard ? firstCard.offsetWidth : el.clientWidth;
    el.scrollBy({ left: dir * cardW, behavior: "smooth" });
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-scroll (só quando há mais de 1 item).
  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        const firstCard = el.querySelector("[data-card]") as HTMLElement | null;
        el.scrollBy({ left: firstCard?.offsetWidth ?? el.clientWidth, behavior: "smooth" });
      }
    }, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length]);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0]?.clientX ?? null; touchDeltaX.current = 0; };
  const onTouchMove = (e: React.TouchEvent) => { if (touchStartX.current == null) return; touchDeltaX.current = (e.touches[0]?.clientX ?? 0) - touchStartX.current; };
  const onTouchEnd = () => { const d = touchDeltaX.current; touchStartX.current = null; if (Math.abs(d) >= 40) scrollCards(d < 0 ? 1 : -1); };

  // Sem bolões futuros no momento: não fabrica dado, só oculta a seção.
  if (loaded && items.length === 0) return null;

  return (
    <section className={className} aria-label="Próximos Bolões">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-black uppercase tracking-[0.04em] text-white">
          PRÓXIMOS BOLÕES
        </h2>
        <Link
          href="/boloes"
          className="shrink-0 text-[13px] font-black uppercase tracking-wide transition-opacity hover:opacity-90"
          style={{ color: GREEN }}
        >
          VER TODOS &gt;
        </Link>
      </div>

      <div className="relative">
        {canPrev && (
          <button
            type="button"
            onClick={() => scrollCards(-1)}
            className="absolute -left-3 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 shadow-md backdrop-blur-sm transition hover:bg-black"
            aria-label="Anterior"
          >
            <ChevronLeft className="size-4 text-white" strokeWidth={2.5} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scroll-smooth"
          style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
          onScroll={updateArrows}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {items.map((item) => (
            <div key={item.id} data-card className={CARD_W} style={{ scrollSnapAlign: "center" }}>
              <UpcomingBolaoCard item={item} />
            </div>
          ))}
        </div>

        {canNext && (
          <button
            type="button"
            onClick={() => scrollCards(1)}
            className="absolute -right-3 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 shadow-md backdrop-blur-sm transition hover:bg-black"
            aria-label="Próximo"
          >
            <ChevronRight className="size-4 text-white" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </section>
  );
}
