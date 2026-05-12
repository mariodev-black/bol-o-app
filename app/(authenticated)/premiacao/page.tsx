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
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import bannerPremiacao from "@/app/assets/banner-presentes.jpeg";
import iconTrofeu from "@/app/assets/icon-trofeu.png";
import { calculatePrizeAwards } from "@/lib/prizes/distribution";
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

/** Simulação oficial (mesma função do sistema) para pool de exemplo R$ 1M e 2.506 classificados. */
const GENERAL_EXAMPLE_POOL_CENTS = 100_000_000;
const GENERAL_SIMULATION_AWARDS = calculatePrizeAwards(
  GENERAL_EXAMPLE_POOL_CENTS,
  2506,
  "general"
);
const GENERAL_SIMULATION_TOTAL_CENTS = GENERAL_SIMULATION_AWARDS.reduce(
  (s, a) => s + a.amountCents,
  0
);

function formatBrlCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

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

function PremiacaoGeralDetalhesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premiacao-detalhes-titulo"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 bg-black/75 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#101010] shadow-[0_-8px_40px_rgba(0,0,0,0.6)] sm:max-h-[85vh] sm:rounded-2xl sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <h2
            id="premiacao-detalhes-titulo"
            className="font-helvetica-now-display text-left text-[15px] font-black uppercase leading-tight tracking-wide text-white sm:text-base"
          >
            Premiação — Bolão do Milhão
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white transition-colors hover:bg-white/10"
            aria-label="Fechar detalhes"
          >
            <X className="size-5" strokeWidth={2.2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <p className="text-[12px] font-medium leading-relaxed text-white/75 sm:text-[13px]">
            O bolão principal premia até o <strong className="text-white">2.506º</strong> lugar. O valor
            disponível para premiação é <strong className="text-primary">60%</strong> da arrecadação dos
            tickets gerais pagos. Abaixo, a simulação posição a posição para um pool de exemplo de{" "}
            <strong className="text-white">R$ 1.000.000,00</strong>, calculada com a mesma regra usada no
            sistema (incluindo ajuste de centavos restantes).
          </p>
          <p className="mt-2 text-[11px] font-medium leading-relaxed text-white/50">
            No app, seu desempenho e posição aparecem no ranking. Critérios de desempate seguem as regras
            oficiais do bolão.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/40">
            <div className="sticky top-0 z-1 grid grid-cols-[minmax(0,4.5rem)_1fr] gap-2 border-b border-white/10 bg-[#141414] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white/55 sm:px-3.5 sm:text-[11px]">
              <span>Pos.</span>
              <span className="text-right">Prêmio (ex.)</span>
            </div>
            <div className="max-h-[min(52vh,420px)] overflow-y-auto sm:max-h-[min(50vh,480px)]">
              {GENERAL_SIMULATION_AWARDS.map((row) => (
                <div
                  key={row.rank}
                  className="grid grid-cols-[minmax(0,4.5rem)_1fr] items-center gap-2 border-b border-white/6 px-3 py-1.5 text-[11px] last:border-b-0 sm:px-3.5 sm:text-[12px]"
                >
                  <span className="font-bold tabular-nums text-white/80">
                    {row.rank}º
                  </span>
                  <span className="text-right font-helvetica-now-display font-black tabular-nums text-primary">
                    {formatBrlCents(row.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-[10px] font-medium text-white/45">
            Total distribuído neste exemplo:{" "}
            <span className="font-black text-primary">{formatBrlCents(GENERAL_SIMULATION_TOTAL_CENTS)}</span>
            {" · "}
            {GENERAL_SIMULATION_AWARDS.length} posições
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-white/10 bg-black/50 px-4 py-3 sm:flex-row sm:justify-end">
          <Link
            href="/ranking"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/35 bg-primary/15 px-4 text-[11px] font-black uppercase text-primary transition-colors hover:bg-primary/25"
          >
            Ver ranking
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/8 px-4 text-[11px] font-black uppercase text-white hover:bg-white/12"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function PrizeTableGeral({ onOpenDetalhes }: { onOpenDetalhes: () => void }) {
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
          <p className="mt-1.5 text-[12px] font-semibold text-white/80 sm:mt-2 sm:text-[12px]">
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
      <button
        type="button"
        onClick={onOpenDetalhes}
        className="flex w-full items-center justify-between gap-2 border-t border-white/8 bg-black/35 px-3 py-2.5 text-left transition-colors hover:bg-black/50 sm:gap-3 sm:px-4 sm:py-3 md:px-5"
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
              Simulação até o 2.506º e como funciona
            </p>
          </div>
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-primary/80 sm:size-5"
          strokeWidth={2.4}
          aria-hidden
        />
      </button>
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
          <p className="mt-0.5 font-helvetica-now-display text-[clamp(1.25rem,4.5vw+0.4rem,2rem)] font-black leading-none tracking-[-0.03em] text-primary sm:text-2xl md:text-[30px]">
            {DAILY_POOL_EXAMPLE_DISPLAY}
          </p>
          <p className="mt-1.5 text-[12px] font-semibold text-white/80 sm:mt-2 sm:text-[12px]">
            R$ 100 mil cheios para premiação · Top 10 · só tickets daquele dia
          </p>
        </div>
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
  const [detalhesGeralOpen, setDetalhesGeralOpen] = useState(false);

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
            {tab === "geral" ? (
              <PrizeTableGeral onOpenDetalhes={() => setDetalhesGeralOpen(true)} />
            ) : (
              <PrizeTableDiario />
            )}
          </div>
        </div>

        <CotaCpa />
      </div>

      <PremiacaoGeralDetalhesModal
        open={detalhesGeralOpen}
        onClose={() => setDetalhesGeralOpen(false)}
      />
    </main>
  );
}
