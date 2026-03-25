"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Coins,
  Trophy,
  Users,
} from "lucide-react";
import bgPalpitesDesk from "@/app/assets/bg-palpites-desktop.png";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FFE8BA";
const CARD = "#0A0E19";

function BoloesBrandIcon() {
  return (
    <div
      className="relative w-16 h-16 rounded-2xl shrink-0 overflow-hidden"
      style={{
        background: "linear-gradient(145deg, rgba(255,232,186,0.14) 0%, rgba(212,175,55,0.1) 50%, rgba(212,175,55,0.04) 100%)",
        border: "1px solid rgba(212, 175, 55, 0.35)",
      }}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <linearGradient id="goldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE8BA" />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="22" r="10" fill="none" stroke="url(#goldStroke)" strokeWidth="3" />
        <path d="M22 31 L14 32 L19 42 L28 39" fill="none" stroke="url(#goldStroke)" strokeWidth="3" strokeLinecap="round" />
        <path d="M42 31 L50 32 L45 42 L36 39" fill="none" stroke="url(#goldStroke)" strokeWidth="3" strokeLinecap="round" />
        <path d="M26 40 L38 40 L36 50 L28 50 Z" fill="none" stroke="url(#goldStroke)" strokeWidth="3" strokeLinejoin="round" />
        <rect x="24" y="50" width="16" height="4" rx="2" fill="url(#goldStroke)" />
      </svg>
    </div>
  );
}

const OPTIONS = [
  {
    title: "BOLÃO PRINCIPAL",
    subtitle:
      "Seu ticket vale da abertura até a final: todos os dias você palpita em todos os jogos do dia e soma pontos no ranking geral.",
    href: "/tickets?bolao=principal",
    prize: "R$ 1.000.000",
    players: "124.582 participantes",
    closeAt: "Apostas válidas durante toda a Copa",
    titleColor: "#FFE8BA",
    ctaLabel: "Jogar Copa inteira",
    chipInfo: "Duração: Copa inteira",
  },
  {
    title: "BOLÃO DIÁRIO",
    subtitle:
      "Seu ticket vale só para os jogos do dia selecionado. No dia seguinte, é necessário um novo ticket diário.",
    href: "/tickets?bolao=diario",
    prize: "R$ 50.000",
    players: "12.430 participantes",
    closeAt: "Válido apenas para os jogos daquele dia",
    titleColor: "#FFFFFF",
    ctaLabel: "Jogar só hoje",
    chipInfo: "Duração: só hoje",
  },
];

export default function BoloesPage() {
  return (
    <div className="min-h-screen px-4 sm:px-6">
      <div className="mx-auto w-full max-w-3xl pt-2 sm:pt-5">

        <section
          className="rounded-2xl border p-4 sm:p-5 mb-4"
          style={{
            background: "#0A0E19",
            borderColor: "rgba(212, 175, 55, 0.25)",
          }}
        >
          <div className="flex items-start gap-4">
            <BoloesBrandIcon />
            <div className="min-w-0">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
                style={{
                  color: GOLD_LIGHT,
                  background: "rgba(212,175,55,0.14)",
                  border: "1px solid rgba(212,175,55,0.3)",
                }}
              >
                Centro de Bolões
              </span>
              <h1 className="text-[34px] md:text-[40px] font-black leading-none text-white">Meus Bolões</h1>
              <p className="text-[15px] mt-2 leading-relaxed text-white/55 max-w-[620px] text-balance">
                Escolha seu formato: ticket válido por toda a Copa ou ticket diário válido apenas para um dia.
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {OPTIONS.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group relative block w-full overflow-hidden rounded-2xl border"
              style={{ borderColor: "rgba(212, 175, 55, 0.25)" }}
            >
              <div className="relative min-h-[310px] sm:min-h-[330px]">
                <Image
                  src={bgPalpitesDesk}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 900px"
                  priority={false}
                />
                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/25 transition-colors" />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(2,8,23,0.84) 0%, rgba(2,8,23,0.46) 45%, rgba(2,8,23,0.84) 100%)",
                  }}
                />
                <div
                  className="absolute inset-0 flex flex-col items-center text-center justify-start px-3 sm:px-3 pt-8 sm:pt-9 pb-7"
                >
                  <span
                    className="font-black tracking-tight leading-[1.05] text-[34px] sm:text-[42px]"
                    style={{ color: item.titleColor }}
                  >
                    {item.title}
                  </span>
                  <span className="text-xs sm:text-sm mt-2 text-white/80 max-w-[520px]">{item.subtitle}</span>

                  <div className="mt-4 flex flex-col items-center gap-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
                      style={{ background: "rgba(212, 175, 55, 0.14)", border: "1px solid rgba(212, 175, 55, 0.35)", color: GOLD_LIGHT }}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      Prêmio: {item.prize}
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white/85"
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)" }}
                      >
                        <Users className="w-3.5 h-3.5" />
                        {item.players}
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white/85"
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)" }}
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        {item.chipInfo}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/80">
                    <CalendarClock className="w-3.5 h-3.5" style={{ color: GOLD }} />
                    {item.closeAt}
                  </div>

                  <span
                    className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-bold transition-transform group-hover:translate-x-0.5"
                    style={{
                      background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`,
                      color: "#0E141B",
                    }}
                  >
                    {item.ctaLabel}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
