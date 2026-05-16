"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Gift, TrendingUp } from "lucide-react";

import iconCardMilhao from "@/app/assets/icon-card-milhao.png";

const PRIMARY = "#B1EB0B";
const CARD_BG = "linear-gradient(145deg, #121212 0%, #0a0a0a 55%, #080808 100%)";
const BORDER = "rgba(255,255,255,0.1)";
const BORDER_GLOW = "rgba(177,235,11,0.22)";

type RankingPromoCardsProps = {
  /** CTA “Quero participar” — bolões / compra de cotas. */
  boloesHref?: string;
};

export function RankingPromoCards({ boloesHref = "/boloes" }: RankingPromoCardsProps) {
  return (
    <div className="mt-6 flex flex-col gap-3.5 pb-1">
      {/* Card prêmios */}
      <article
        className="group relative overflow-hidden rounded-2xl border px-3.5 py-3.5 shadow-[0_14px_40px_rgba(0,0,0,0.55)] transition-[box-shadow,transform] duration-300 hover:shadow-[0_18px_48px_rgba(0,0,0,0.65)]"
        style={{
          background: CARD_BG,
          borderColor: BORDER,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(177,235,11,0.06)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-8 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full opacity-[0.12] blur-3xl transition-opacity duration-500 group-hover:opacity-[0.2]"
          style={{ background: PRIMARY }}
        />
        <div className="relative flex items-center gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            style={{
              borderColor: BORDER_GLOW,
              background: "linear-gradient(180deg, rgba(177,235,11,0.14) 0%, rgba(177,235,11,0.04) 100%)",
            }}
          >
            <Gift className="size-6 text-primary" strokeWidth={2.2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-black uppercase leading-tight tracking-wide text-white">
              Mais de{" "}
              <span className="text-primary" style={{ textShadow: "0 0 24px rgba(177,235,11,0.35)" }}>
                R$1 MILHÃO
              </span>
            </h3>
            <p className="mt-1 text-[14px] font-medium leading-snug text-white/58">
              em premiação para os melhores!
            </p>
          </div>
          <div className="relative h-18 w-21 shrink-0">
            <Image
              src={iconCardMilhao}
              alt=""
              fill
              className="object-contain object-right drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-[1.04]"
              sizes="84px"
              priority={false}
            />
          </div>
        </div>
      </article>

      {/* Card palpites / CTA */}
      <article
        className="group relative overflow-hidden rounded-2xl border px-3.5 py-3.5 shadow-[0_14px_40px_rgba(0,0,0,0.55)] transition-[box-shadow,transform] duration-300 hover:shadow-[0_18px_48px_rgba(0,0,0,0.65)]"
        style={{
          background: CARD_BG,
          borderColor: BORDER,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(177,235,11,0.06)",
        }}
      >
        <div
          className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full opacity-[0.1] blur-3xl transition-opacity duration-500 group-hover:opacity-[0.16]"
          style={{ background: PRIMARY }}
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              style={{
                borderColor: BORDER_GLOW,
                background: "linear-gradient(180deg, rgba(177,235,11,0.14) 0%, rgba(177,235,11,0.04) 100%)",
              }}
            >
              <TrendingUp className="size-6 text-primary" strokeWidth={2.3} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-[16px] font-black uppercase leading-tight tracking-wide">
                <span className="text-primary" style={{ textShadow: "0 0 20px rgba(177,235,11,0.3)" }}>
                  Faça seus palpites
                </span>{" "}
                <span className="text-white">e suba na tabela!</span>
              </h3>
              <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-white/55">
                Cada acerto te aproxima dos prêmios. Participe e viva a Copa de um jeito novo!
              </p>
            </div>
          </div>
          <Link
            href={boloesHref}
            className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-[14px] font-black uppercase tracking-wide text-[#0E141B] shadow-[0_4px_20px_rgba(177,235,11,0.25)] transition-[transform,box-shadow] active:scale-[0.98] sm:mt-0 sm:h-10 sm:w-auto sm:min-w-46"
            style={{ background: PRIMARY }}
          >
            Quero participar
            <ChevronRight className="size-4 shrink-0" strokeWidth={2.8} aria-hidden />
          </Link>
        </div>
      </article>
    </div>
  );
}
