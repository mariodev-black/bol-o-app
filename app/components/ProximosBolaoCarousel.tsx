"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import iconUCL from "@/app/assets/ucl-logo.png";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import iconBrasileirao from "@/app/assets/icon-brasileirao2.png";
import iconCopa from "@/app/assets/icon-copa-mundo2.png";
import type { StaticImageData } from "next/image";
import type { HomeBolaoCard } from "@/lib/home-content/types";

const GREEN = "#B1EB0B";
const CARD_BG = "#0d0d0d";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const INTERVAL_MS = 4500;

type BolaoCard = {
  id: string;
  badge: string;
  badgeVariant: "primary" | "muted";
  /** StaticImageData (fallback) ou URL string (dinâmico). null = flags BRA×MAR. */
  logo: StaticImageData | string | null;
  flagBR?: boolean;
  name: string;
  dateText: string;
  timeText: string;
  prizeLabel: string;
  prizeUnit: string;
  isPrimary: boolean;
  href: string;
};

/** Cards padrão (fallback) quando o admin ainda não cadastrou nenhum. */
const FALLBACK_CARDS: BolaoCard[] = [
  {
    id: "copa",
    badge: "MAIS PREMIADO",
    badgeVariant: "primary",
    logo: iconCopa,
    name: "COPA DO MUNDO",
    dateText: "EM BREVE",
    timeText: "",
    prizeLabel: "R$ 1.000.000",
    prizeUnit: "NO PIX",
    isPrimary: true,
    href: "/comprar-cotas",
  },
  {
    id: "champions",
    badge: "EM BREVE",
    badgeVariant: "muted",
    logo: iconUCL,
    name: "CHAMPIONS LEAGUE",
    dateText: "TER, 11/06",
    timeText: "16:00",
    prizeLabel: "R$ 500.000",
    prizeUnit: "NO PIX",
    isPrimary: false,
    href: "/tickets?bolao=extra",
  },
  {
    id: "copa-brasil",
    badge: "EM BREVE",
    badgeVariant: "muted",
    logo: iconCopaBrasil,
    name: "COPA DO BRASIL",
    dateText: "QUA, 12/06",
    timeText: "19:00",
    prizeLabel: "R$ 300.000",
    prizeUnit: "NO PIX",
    isPrimary: false,
    href: "/tickets?bolao=extra",
  },
  {
    id: "brasileirao",
    badge: "EM BREVE",
    badgeVariant: "muted",
    logo: iconBrasileirao,
    name: "BRASILEIRÃO",
    dateText: "QUI, 13/06",
    timeText: "21:00",
    prizeLabel: "R$ 400.000",
    prizeUnit: "NO PIX",
    isPrimary: false,
    href: "/tickets?bolao=extra",
  },
];

function mapDynamicCard(c: HomeBolaoCard): BolaoCard {
  return {
    id: c.id,
    badge: c.badge ?? "",
    badgeVariant: c.badgeVariant,
    logo: c.imageUrl,
    name: c.name,
    dateText: c.dateText ?? "",
    timeText: c.timeText ?? "",
    prizeLabel: c.prizeLabel ?? "",
    prizeUnit: c.prizeUnit ?? "",
    isPrimary: c.isPrimary,
    href: c.href || "#",
  };
}

function BolaoCard({ card }: { card: BolaoCard }) {
  const badgeBg = card.badgeVariant === "primary" ? GREEN : "rgba(255,255,255,0.10)";
  const badgeColor = card.badgeVariant === "primary" ? "#0E141B" : "rgba(255,255,255,0.65)";

  return (
    <Link
      href={card.href}
      data-card
      className="relative flex w-[230px] shrink-0 flex-col overflow-hidden rounded-[14px] border transition active:scale-[0.98] hover:brightness-105 sm:w-[240px] lg:w-[158px]"
      style={{ background: CARD_BG, borderColor: CARD_BORDER }}
      aria-label={card.name}
    >
      {/* Badge */}
      <div
        className="flex h-7 w-full items-center justify-center text-[10px] font-black uppercase tracking-widest"
        style={{ background: badgeBg, color: badgeColor }}
      >
        {card.badge}
      </div>

      {/* Logo */}
      <div className="flex h-[60px] items-center justify-center px-2 pt-2">
        {typeof card.logo === "string" ? (
          // Logo dinâmico (servido do nosso backend) — <img> simples.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.logo}
            alt=""
            className="h-[48px] w-auto max-w-[90px] object-contain"
            draggable={false}
          />
        ) : card.logo ? (
          <Image
            src={card.logo}
            alt=""
            width={80}
            height={48}
            className="h-[48px] w-auto max-w-[90px] object-contain"
            draggable={false}
          />
        ) : (
          <Image src={iconCopa} alt="" width={40} height={40} className="size-10 rounded-full object-cover" draggable={false} />
        )}
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3">
        {/* Name */}
        <p className="mt-1.5 text-center text-[11px] font-black uppercase leading-tight tracking-tight text-white">
          {card.name}
        </p>
        {/* Date */}
        <p className="mt-1 text-center text-[10px] font-bold" style={{ color: GREEN }}>
          {[card.dateText, card.timeText].filter(Boolean).join(" · ")}
        </p>

        {/* Divider */}
        <div className="my-2.5 h-px w-full bg-white/8" />

        {/* Prize */}
        <div className="flex-1 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/40">
            PRÊMIO GARANTIDO
          </p>
          <p className="mt-0.5 text-[16px] font-black leading-none" style={{ color: GREEN }}>
            {card.prizeLabel}
          </p>
          <p className="mt-0.5 text-[9px] font-semibold text-white/50">{card.prizeUnit}</p>
        </div>

        {/* Button */}
        <div
          className="mt-3 flex h-8 w-full items-center justify-center rounded-[8px] text-[10px] font-black uppercase tracking-wide"
          style={
            card.isPrimary
              ? { background: GREEN, color: "#0E141B" }
              : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.12)" }
          }
        >
          {card.isPrimary ? "PARTICIPAR" : "QUERO PARTICIPAR"}
        </div>
      </div>
    </Link>
  );
}

export function ProximosBolaoCarousel({ className = "" }: { className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<BolaoCard[]>(FALLBACK_CARDS);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Busca cards dinâmicos do admin; se não houver, mantém o fallback.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/public/home-content", { cache: "no-store" });
        const d = (await r.json()) as { cards?: HomeBolaoCard[] };
        if (cancelled) return;
        if (d.cards && d.cards.length > 0) {
          setCards(d.cards.map(mapDynamicCard));
        }
      } catch {
        /* mantém fallback */
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

  // Auto-scroll
  useEffect(() => {
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
  }, []);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0]?.clientX ?? null; touchDeltaX.current = 0; };
  const onTouchMove = (e: React.TouchEvent) => { if (touchStartX.current == null) return; touchDeltaX.current = (e.touches[0]?.clientX ?? 0) - touchStartX.current; };
  const onTouchEnd = () => { const d = touchDeltaX.current; touchStartX.current = null; if (Math.abs(d) >= 40) scrollCards(d < 0 ? 1 : -1); };

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
        {/* Arrow prev */}
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

        {/* Track */}
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scroll-smooth"
          style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
          onScroll={updateArrows}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {cards.map((card) => (
            <BolaoCard key={card.id} card={card} />
          ))}
        </div>

        {/* Arrow next */}
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
