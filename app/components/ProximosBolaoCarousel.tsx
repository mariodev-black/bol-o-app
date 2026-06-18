"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import iconCopaMundo from "@/app/assets/icon-copa-mundo2.png";
import iconArtilheiro from "@/app/assets/icon-artilheiro.png";
import logoBolaoDialio from "@/app/assets/logo-bolao-diario.png";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import type { StaticImageData } from "next/image";

const GREEN = "#B1EB0B";
const CARD_BG = "#111111";
const BORDER = "rgba(255,255,255,0.08)";
const INTERVAL_MS = 4500;

type BadgeVariant = "hot" | "new" | "highlight";

type BolaoCardDef = {
  id: string;
  logo: StaticImageData;
  name: string;
  description: string;
  prizeLabel: string;
  prizeSub?: string;
  badge?: { label: string; variant: BadgeVariant };
  href: string;
};

const BADGE_STYLES: Record<BadgeVariant, { bg: string; text: string }> = {
  hot:       { bg: "#FF5A1F", text: "#fff" },
  new:       { bg: "#0078D4", text: "#fff" },
  highlight: { bg: GREEN,     text: "#0E141B" },
};

const CARDS: BolaoCardDef[] = [
  {
    id: "milhao",
    logo: iconCopaMundo,
    name: "BOLÃO DO MILHÃO",
    description: "Acerte os placares da Copa do Mundo",
    prizeLabel: "R$ 1.000.000",
    prizeSub: "no PIX",
    badge: { label: "🔥 MAIS VENDIDO", variant: "hot" },
    href: "/comprar-cotas",
  },
  {
    id: "artilheiro",
    logo: iconArtilheiro,
    name: "ARTILHEIRO DA COPA",
    description: "Acerte o artilheiro da Copa do Mundo",
    prizeLabel: "R$ 20.000",
    prizeSub: "no PIX",
    badge: { label: "🆕 NOVO", variant: "new" },
    href: "/tickets?bolao=artilheiros",
  },
  {
    id: "diario",
    logo: logoBolaoDialio,
    name: "BOLÃO DO DIA",
    description: "Palpite nos jogos do dia e ganhe prêmios diários",
    prizeLabel: "Prêmio variável",
    prizeSub: "todo dia",
    badge: { label: "🔥 MAIS VENDIDO", variant: "hot" },
    href: "/tickets?bolao=diario",
  },
  {
    id: "copafds",
    logo: iconCopaBrasil,
    name: "COPA SÁB E DOM",
    description: "100% da arrecadação distribuída entre os vencedores",
    prizeLabel: "100% arrecadado",
    prizeSub: "distribuído",
    badge: { label: "⭐ DESTAQUE", variant: "highlight" },
    href: "/copa-fds",
  },
];

function BolaoCard({ card }: { card: BolaoCardDef }) {
  const badge = card.badge ? BADGE_STYLES[card.badge.variant] : null;
  return (
    <Link
      href={card.href}
      className="relative flex w-full shrink-0 flex-col overflow-hidden rounded-[16px] border transition active:scale-[0.98] hover:brightness-105"
      style={{ background: CARD_BG, borderColor: BORDER }}
      aria-label={`${card.name} — ${card.prizeLabel}`}
    >
      {card.badge && badge ? (
        <span
          className="absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-black uppercase leading-none tracking-wide"
          style={{ background: badge.bg, color: badge.text }}
        >
          {card.badge.label}
        </span>
      ) : null}

      <div className="flex items-center justify-center px-4 pb-2 pt-10">
        <Image
          src={card.logo}
          alt=""
          width={100}
          height={60}
          className="h-[60px] w-auto max-w-[120px] object-contain"
          draggable={false}
        />
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4">
        <p className="text-[14px] font-black uppercase leading-tight tracking-[0.02em] text-white">
          {card.name}
        </p>
        <p className="mt-1 text-[11px] font-medium leading-snug text-white/65">
          {card.description}
        </p>

        <div className="mt-3 flex-1">
          <p className="text-[11px] font-black uppercase tracking-widest text-white/40">
            PREMIAÇÃO GARANTIDA
          </p>
          <p
            className="mt-0.5 text-[20px] font-black leading-none tracking-tight"
            style={{ color: GREEN }}
          >
            {card.prizeLabel}
          </p>
          {card.prizeSub ? (
            <p className="mt-0.5 text-[11px] font-semibold text-white/55">
              {card.prizeSub}
            </p>
          ) : null}
        </div>

        <div
          className="mt-4 flex h-10 items-center justify-center rounded-[10px] text-[12px] font-black uppercase tracking-wide"
          style={{ background: GREEN, color: "#0E141B" }}
        >
          PARTICIPAR
        </div>
      </div>
    </Link>
  );
}

export function ProximosBolaoCarousel({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = CARDS.length;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, INTERVAL_MS);
  }, [total]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const goTo = useCallback(
    (i: number) => {
      setIndex(i);
      startTimer();
    },
    [startTimer],
  );

  const prev = useCallback(() => goTo((index - 1 + total) % total), [goTo, index, total]);
  const next = useCallback(() => goTo((index + 1) % total), [goTo, index, total]);

  // Touch / swipe
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = (e.touches[0]?.clientX ?? 0) - touchStartX.current;
  };
  const onTouchEnd = () => {
    const delta = touchDeltaX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    delta < 0 ? next() : prev();
  };

  return (
    <section
      className={`${className}`}
      aria-label="Próximos Bolões"
    >
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

      <div className="relative" style={{ touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Track */}
        <div className="overflow-hidden rounded-[16px]">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {CARDS.map((card) => (
              <BolaoCard key={card.id} card={card} />
            ))}
          </div>
        </div>

        {/* Prev / Next arrows */}
        <button
          type="button"
          onClick={prev}
          className="absolute left-2 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 backdrop-blur-sm transition hover:bg-black/80"
          aria-label="Anterior"
        >
          <ChevronLeft className="size-4 text-white" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={next}
          className="absolute right-2 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 backdrop-blur-sm transition hover:bg-black/80"
          aria-label="Próximo"
        >
          <ChevronRight className="size-4 text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Dots */}
      <div className="mt-2.5 flex items-center justify-center gap-1.5">
        {CARDS.map((card, i) => (
          <button
            key={card.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Bolão ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-5 bg-[#B1EB0B]" : "w-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
