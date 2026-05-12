"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  FileText,
  Lock,
  Shield,
  Ticket,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import bannerPremiacao from "@/app/assets/banner-presentes.jpeg";
import iconTrofeu from "@/app/assets/icon-trofeu.png";
import { CotaCpa } from "../components/ui/cota_cpa";

type TabId = "geral" | "diario";

/** Painéis — mesma estrutura; cores do layout “premiação” (preto + limão) */
const surfacePanel =
  "overflow-hidden rounded-xl border border-white/14 bg-[#0a0a0a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-2xl";
const prizeCardInner =
  "overflow-hidden rounded-lg border border-primary/35 bg-[#121212] shadow-[0_0_32px_rgba(177,235,11,0.08),inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-xl";

const GENERAL_PRIZE_ROWS: { rank: string; prize: string }[] = [
  { rank: "1º lugar", prize: "R$ 180.000,00" },
  { rank: "2º lugar", prize: "R$ 90.000,00" },
  { rank: "3º lugar", prize: "R$ 50.000,00" },
  { rank: "4º lugar", prize: "R$ 35.000,00" },
  { rank: "5º lugar", prize: "R$ 25.000,00" },
  { rank: "6º lugar", prize: "R$ 18.000,00" },
  { rank: "7º lugar", prize: "R$ 14.000,00" },
  { rank: "8º lugar", prize: "R$ 11.000,00" },
  { rank: "9º lugar", prize: "R$ 9.000,00" },
  { rank: "10º lugar", prize: "R$ 7.000,00" },
];

const GENERAL_FOOTNOTE =
  "Valores proporcionais a um pool de exemplo de R$ 1.000.000. O pool real é 60% da arrecadação dos tickets gerais pagos — distribuição até o 2.506º lugar.";

/** Valor de exemplo na UI do diário: R$ 100 mil como premiação total do dia (Top 10). */
const DAILY_POOL_EXAMPLE_DISPLAY = "R$ 100.000";

const DAILY_PRIZE_ROWS: { rank: string; percent: string; example: string }[] = [
  { rank: "1º lugar", percent: "37,59%", example: "R$ 37.593,10" },
  { rank: "2º lugar", percent: "18,80%", example: "R$ 18.796,50" },
  { rank: "3º lugar", percent: "10,44%", example: "R$ 10.443,60" },
  { rank: "4º lugar", percent: "7,52%", example: "R$ 7.518,80" },
  { rank: "5º lugar", percent: "6,27%", example: "R$ 6.265,70" },
  { rank: "6º lugar", percent: "5,01%", example: "R$ 5.012,50" },
  { rank: "7º lugar", percent: "4,18%", example: "R$ 4.177,40" },
  { rank: "8º lugar", percent: "3,76%", example: "R$ 3.759,40" },
  { rank: "9º lugar", percent: "3,34%", example: "R$ 3.341,70" },
  { rank: "10º lugar", percent: "3,09%", example: "R$ 3.090,20" },
];

const DAILY_FOOTNOTE =
  "Exemplo para um dia em que há R$ 100.000 inteiros em premiação no bolão diário, divididos entre o Top 10 nas porcentagens oficiais. Se houver menos de 10 classificados, a sobra é redistribuída entre os vencedores.";

function RankMedal({ place }: { place: number }) {
  const base =
    "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ring-1 ring-white/10 sm:size-9 sm:text-[11px] md:size-10 md:text-xs";
  if (place === 1) {
    return (
      <span
        className={`${base} text-[#160F00]`}
        style={{
          background:
            "linear-gradient(145deg, #FFF7A8 0%, #F8C341 42%, #9E6500 100%)",
          boxShadow: "0 0 12px rgba(248,195,65,0.28)",
        }}
      >
        1
      </span>
    );
  }
  if (place === 2) {
    return (
      <span
        className={`${base} text-[#101419]`}
        style={{
          background:
            "linear-gradient(145deg, #FFFFFF 0%, #AEB5BF 52%, #525B66 100%)",
          boxShadow: "0 0 10px rgba(226,232,240,0.15)",
        }}
      >
        2
      </span>
    );
  }
  if (place === 3) {
    return (
      <span
        className={`${base} text-[#190A02]`}
        style={{
          background:
            "linear-gradient(145deg, #FFD0A3 0%, #C56F27 48%, #67330F 100%)",
          boxShadow: "0 0 10px rgba(197,111,39,0.2)",
        }}
      >
        3
      </span>
    );
  }
  return (
    <span className={`${base} border border-white/10 bg-white/5 text-white/75`}>
      {place}
    </span>
  );
}

function PrizeTableGeral() {
  return (
    <div className={`${prizeCardInner}`}>
      <div className="flex items-start gap-2 border-b border-white/8 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4 md:px-5 md:py-5">
        <Image
          src={iconTrofeu}
          alt=""
          width={70}
          height={70}
          className="size-11 shrink-0 object-contain sm:size-14 md:size-[70px]"
          sizes="(max-width:640px) 44px, 70px"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wide text-white/80 sm:text-[11px]">
            Premiação total
          </p>
          <p className="mt-0.5 font-helvetica-now-display text-[clamp(1.25rem,4.5vw+0.4rem,2rem)] font-black leading-none tracking-[-0.03em] text-primary sm:text-3xl md:text-[34px]">
            R$ 1.000.000
          </p>
          <p className="mt-1.5 text-[11px] font-semibold text-white/55 sm:mt-2 sm:text-[11px]">
            + de 2.500 premiados no bolão principal
          </p>
        </div>
      </div>
      <div className="divide-y divide-white/6">
        {GENERAL_PRIZE_ROWS.map((row, i) => (
          <div
            key={row.rank}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5 md:px-5 md:py-3"
          >
            <RankMedal place={i + 1} />
            <p className="min-w-0 text-[11px] font-black uppercase tracking-wide text-white sm:text-xs md:text-sm">
              {row.rank}
            </p>
            <p className="text-right font-helvetica-now-display text-[12px] font-black tabular-nums text-primary sm:text-sm md:text-base">
              {row.prize}
            </p>
          </div>
        ))}
      </div>
      <p className="border-t border-white/8 px-3 py-2.5 text-[12px] font-medium leading-snug text-white/80 sm:px-4 sm:py-3 sm:text-[11px] md:px-5">
        {GENERAL_FOOTNOTE}
      </p>
      <Link
        href="/ranking"
        className="flex items-center justify-between gap-2 border-t border-white/8 bg-black/35 px-3 py-2.5 transition-colors hover:bg-black/50 sm:gap-3 sm:px-4 sm:py-3 md:px-5"
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 sm:size-9">
            <FileText
              className="size-3.5 text-primary sm:size-4"
              strokeWidth={2.2}
            />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wide text-primary sm:text-[11px]">
              Saiba mais sobre a premiação
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-white/40 sm:text-[11px]">
              Ranking, faixas e critérios de desempate
            </p>
          </div>
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-primary/80 sm:size-5"
          strokeWidth={2.4}
        />
      </Link>
    </div>
  );
}

function PrizeTableDiario() {
  return (
    <div className={`${prizeCardInner}`}>
      <div className="flex items-start gap-2 border-b border-white/8 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4 md:px-5 md:py-5">
        <Image
          src={iconTrofeu}
          alt=""
          width={70}
          height={70}
          className="size-11 shrink-0 object-contain sm:size-14 md:size-[70px]"
          sizes="(max-width:640px) 44px, 70px"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wide text-white/80 sm:text-[11px]">
            Premiação do dia (exemplo)
          </p>
          <p className="mt-0.5 font-helvetica-now-display text-[clamp(1.15rem,4vw+0.35rem,1.75rem)] font-black leading-none tracking-[-0.03em] text-primary sm:text-2xl md:text-[30px]">
            {DAILY_POOL_EXAMPLE_DISPLAY}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold text-white/55 sm:mt-2 sm:text-[11px]">
            R$ 100 mil cheios para premiação · Top 10 · só tickets daquele dia
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-x-1.5 border-b border-white/8 px-3 py-1.5 text-[8px] font-black uppercase tracking-wider text-white/38 sm:gap-x-2 sm:px-4 sm:py-2 sm:text-[11px] md:px-5">
        <span className="col-span-1" />
        <span>Posição</span>
        <span className="text-right">% do total</span>
        <span className="text-right">Prêmio</span>
      </div>
      <div className="divide-y divide-white/6">
        {DAILY_PRIZE_ROWS.map((row, i) => (
          <div
            key={row.rank}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-1.5 gap-y-0.5 px-3 py-2 sm:gap-x-2 sm:px-4 sm:py-2.5 md:px-5"
          >
            <RankMedal place={i + 1} />
            <p className="min-w-0 text-[11px] font-black uppercase tracking-wide text-white sm:text-xs md:text-sm">
              {row.rank}
            </p>
            <p className="text-right text-[11px] font-bold tabular-nums text-white/65 sm:text-xs md:text-sm">
              {row.percent}
            </p>
            <p className="text-right font-helvetica-now-display text-[11px] font-black tabular-nums text-primary sm:text-xs md:text-sm">
              {row.example}
            </p>
          </div>
        ))}
      </div>
      <p className="border-t border-white/8 px-3 py-2.5 text-[11px] font-medium leading-snug text-white/42 sm:px-4 sm:py-3 sm:text-[11px] md:px-5">
        {DAILY_FOOTNOTE}
      </p>
    </div>
  );
}

export default function PremiacaoPage() {
  const [tab, setTab] = useState<TabId>("geral");

  return (
    <main className="min-h-screen bg-black pb-24 text-white sm:pb-28">
      {/* Banner: altura fluida no mobile; proporção natural em telas maiores */}
      <section className="relative w-full overflow-hidden bg-black">
        <Image
          src={bannerPremiacao}
          alt=""
          width={bannerPremiacao.width}
          height={bannerPremiacao.height}
          className="block h-auto w-full max-h-[min(38svh,220px)] object-cover object-[50%_20%] sm:max-h-[min(48svh,300px)] md:max-h-none md:object-[50%_center]"
          sizes="100vw"
          priority
        />
      </section>

      {/* Bloco abaixo do banner: tabs + conteúdo (cores escuras + limão) */}
      <div className="relative z-10 mx-auto w-full max-w-full px-3 pt-2 sm:max-w-lg sm:px-5 sm:pt-6 md:max-w-xl">
        <div className={surfacePanel}>
          <div
            className="flex border-b border-white/8 bg-[#0c0c0c] shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]"
            role="tablist"
            aria-label="Tipo de bolão"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "geral"}
              onClick={() => setTab("geral")}
              className={`relative min-h-[48px] flex-1 overflow-hidden rounded-tl-lg py-2.5 pl-1.5 pr-1 font-helvetica-now-display text-[11px] font-black uppercase leading-tight tracking-wide transition-colors duration-200 sm:min-h-[54px] sm:rounded-tl-xl sm:py-3 sm:text-[12px] md:text-[13px] ${
                tab === "geral"
                  ? "z-30 text-[#0E141B]"
                  : "z-10 text-white/88 hover:text-white"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50`}
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 transform-[translateZ(0)] backface-hidden ${
                  tab === "geral"
                    ? "left-0 w-[calc(100%+18px)] origin-bottom-right -skew-x-10 rounded-tl-lg bg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] sm:w-[calc(100%+22px)] sm:rounded-tl-xl"
                    : "right-0 w-[calc(100%+18px)] origin-bottom-left skew-x-10 rounded-tl-lg bg-[#131313] shadow-[inset_0_2px_0_0_var(--primary),inset_0_-1px_0_rgba(0,0,0,0.4)] sm:w-[calc(100%+22px)] sm:rounded-tl-xl"
                }`}
              />
              <span className="relative z-10 flex min-h-[44px] items-center justify-center gap-2 sm:min-h-[48px] sm:gap-2">
                <Trophy
                  className={`size-[18px] shrink-0 sm:size-5 ${tab === "geral" ? "text-[#0E141B]" : "text-white"}`}
                  strokeWidth={tab === "geral" ? 2.5 : 2.1}
                />
                <span className="max-w-38 text-center leading-tight sm:max-w-none">
                  Bolão do Milhão
                </span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "diario"}
              onClick={() => setTab("diario")}
              className={`relative min-h-[48px] flex-1 overflow-hidden rounded-tr-lg py-2.5 pl-1 pr-1.5 font-helvetica-now-display text-[11px] font-black uppercase leading-tight tracking-wide transition-colors duration-200 sm:min-h-[54px] sm:rounded-tr-xl sm:py-3 sm:text-[12px] md:text-[13px] ${
                tab === "diario"
                  ? "z-30 text-[#0E141B]"
                  : "z-10 text-white/88 hover:text-white"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50`}
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 transform-[translateZ(0)] backface-hidden ${
                  tab === "diario"
                    ? "right-0 w-[calc(100%+18px)] origin-bottom-left skew-x-10 rounded-tr-lg bg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] sm:w-[calc(100%+22px)] sm:rounded-tr-xl"
                    : "left-0 w-[calc(100%+18px)] origin-bottom-right -skew-x-10 rounded-tr-lg bg-[#131313] shadow-[inset_0_2px_0_0_var(--primary),inset_0_-1px_0_rgba(0,0,0,0.4)] sm:w-[calc(100%+22px)] sm:rounded-tr-xl"
                }`}
              />
              <span className="relative z-10 flex min-h-[44px] items-center justify-center gap-2 sm:min-h-[48px] sm:gap-2">
                <Zap
                  className={`size-[18px] shrink-0 sm:size-5 ${tab === "diario" ? "text-[#0E141B]" : "text-white"}`}
                  strokeWidth={tab === "diario" ? 2.5 : 2.1}
                />
                <span className="max-w-38 text-center leading-tight sm:max-w-none">
                  Bolão diário
                </span>
              </span>
            </button>
          </div>

          <div className="bg-[#0a0a0a] p-2.5 sm:p-3 md:p-4">
            {tab === "geral" ? <PrizeTableGeral /> : <PrizeTableDiario />}
          </div>
        </div>

        <CotaCpa />

      </div>
    </main>
  );
}
