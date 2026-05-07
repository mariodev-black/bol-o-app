"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart2, ChevronDown } from "lucide-react";
import { StepsBreadcrumb } from "../_components/StepsBreadcrumb";

export const dynamic = "force-dynamic";

const GOLD = "#B1EB0B";
const GOLD_LIGHT = "#E8FF8A";
const CARD = "#101010";

type TicketItem = {
  id: string;
  label: string;
  value: string;
  valid: string;
  status: "active" | "expired";
  statusLabel: string;
  jogos: string;
  janela: string;
  limite: string;
  eventDate: string;
  ranking: number;
  points: number;
};

function BrandTicketIcon() {
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
      style={{
        background: "linear-gradient(150deg, rgba(217,255,89,0.16) 0%, rgba(177,235,11,0.06) 100%)",
        border: "1px solid rgba(177,235,11,0.34)",
      }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path
          d="M5 7.5h14a2 2 0 0 1 0 4 2 2 0 0 0 0 4 2 2 0 0 1 0 4H5a2 2 0 0 1 0-4 2 2 0 0 0 0-4 2 2 0 0 1 0-4Z"
          fill="none"
          stroke={GOLD_LIGHT}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 9v6" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function PriceIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 shrink-0" aria-hidden>
      <rect x="3" y="6" width="14" height="9" rx="2" fill="none" stroke={GOLD} strokeWidth="1.6" />
      <path d="M6 9.5h8" stroke={GOLD_LIGHT} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const TICKETS = {
  principal: [
    {
      id: "CP-2026-001",
      label: "Ticket Copa #001",
      value: "R$ 39,90",
      valid: "Válido até a final",
      status: "active",
      statusLabel: "Ativo e elegível",
      jogos: "Todos os jogos do dia, em cada dia da Copa",
      janela: "Ticket válido da abertura até a final",
      limite: "1 palpite por jogo do dia",
      eventDate: "12/06/2026",
      ranking: 41,
      points: 128,
    },
    {
      id: "CP-2026-002",
      label: "Ticket Copa #002",
      value: "R$ 39,90",
      valid: "Válido até a final",
      status: "active",
      statusLabel: "Ativo e elegível",
      jogos: "Todos os jogos do dia, em cada dia da Copa",
      janela: "Ticket válido da abertura até a final",
      limite: "1 palpite por jogo do dia",
      eventDate: "13/06/2026",
      ranking: 33,
      points: 136,
    },
  ] satisfies TicketItem[],
  diario: [
    {
      id: "CD-2026-341",
      label: "Ticket Diário #341",
      value: "R$ 10,00",
      valid: "Válido só hoje",
      status: "active",
      statusLabel: "Aberto para o dia",
      jogos: "Somente os jogos daquele dia",
      janela: "Ticket diário: válido por 1 dia",
      limite: "1 palpite por jogo do dia",
      eventDate: "25/03/2026",
      ranking: 18,
      points: 22,
    },
    {
      id: "CD-2026-342",
      label: "Ticket Diário #342",
      value: "R$ 10,00",
      valid: "Válido só hoje",
      status: "active",
      statusLabel: "Aberto para o dia",
      jogos: "Somente os jogos daquele dia",
      janela: "Ticket diário: válido por 1 dia",
      limite: "1 palpite por jogo do dia",
      eventDate: "26/03/2026",
      ranking: 11,
      points: 25,
    },
    {
      id: "CD-2026-343",
      label: "Ticket Diário #343",
      value: "R$ 10,00",
      valid: "Jogo encerrado",
      status: "expired",
      statusLabel: "Partida ja encerrada",
      jogos: "Somente os jogos daquele dia",
      janela: "Ticket diário: válido por 1 dia",
      limite: "1 palpite por jogo do dia",
      eventDate: "24/03/2026",
      ranking: 29,
      points: 17,
    },
  ] satisfies TicketItem[],
} as const;

function TicketExtraRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-[12px] leading-snug">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className="text-white/88 text-right font-medium">{value}</span>
    </div>
  );
}

const PAGE_BG = "var(--background)";

function TicketPerforation({ tone = "gold" as "gold" | "red" }) {
  const line = tone === "red" ? "rgba(248,113,113,0.45)" : "rgba(177,235,11,0.35)";
  return (
    <div className="relative h-4 shrink-0 w-full" aria-hidden>
      <div
        className="absolute left-0 top-1/2 z-1 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: PAGE_BG, boxShadow: `inset 0 0 0 1px ${line}` }}
      />
      <div
        className="absolute right-0 top-1/2 z-1 h-[14px] w-[14px] translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: PAGE_BG, boxShadow: `inset 0 0 0 1px ${line}` }}
      />
      <div
        className="absolute left-[14px] right-[14px] top-1/2 -translate-y-1/2 border-t border-dashed"
        style={{ borderColor: "rgba(255,255,255,0.22)" }}
      />
    </div>
  );
}

/** Entalhes laterais no meio do bilhete (efeito “mordida” na borda) */
function TicketSideNotches({ tone = "gold" as "gold" | "red" }) {
  const ring = tone === "red" ? "rgba(248,113,113,0.4)" : "rgba(177,235,11,0.4)";
  return (
    <>
      <div
        className="pointer-events-none absolute left-0 top-[46%] z-2 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: PAGE_BG, boxShadow: `inset 0 0 0 1px ${ring}` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-0 top-[46%] z-2 h-[15px] w-[15px] translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: PAGE_BG, boxShadow: `inset 0 0 0 1px ${ring}` }}
        aria-hidden
      />
    </>
  );
}

function TicketsBoloesPageContent() {
  const [bolao, setBolao] = useState<"principal" | "diario">("principal");

  useEffect(() => {
    setBolao(new URLSearchParams(window.location.search).get("bolao") === "diario" ? "diario" : "principal");
  }, []);

  const tickets = TICKETS[bolao];
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const title = bolao === "principal" ? "Bolão Principal" : "Bolão Diário";
  const subtitle =
    bolao === "principal"
      ? "No principal, o ticket vale a Copa inteira: você palpita todos os dias em todos os jogos do dia."
      : "No diário, o ticket vale apenas para os jogos daquele dia.";

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <StepsBreadcrumb backHref="/boloes" items={["Bolões", "Tickets"]} />

        <section className="rounded-2xl border p-4 sm:p-5 mb-4" style={{ background: CARD, borderColor: "rgba(177,235,11,0.24)" }}>
          <div className="flex items-start gap-3">
            <BrandTicketIcon />
            <div>
              <h1 className="text-[30px] sm:text-[34px] font-black text-white leading-tight">{title}</h1>
              <p className="text-[14px] mt-1.5 text-white/65">{subtitle}</p>
            </div>
          </div>
        </section>

        <div className="space-y-3.5">
          {tickets.map((t) => {
            const open = detailsOpen[t.id] ?? false;
            return (
              <article
                key={t.id}
                className="relative rounded-[14px]"
                style={{
                  opacity: t.status === "expired" ? 0.88 : 1,
                  border: `1px solid ${t.status === "expired" ? "rgba(239,68,68,0.45)" : "rgba(177,235,11,0.45)"}`,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
                  background: `linear-gradient(165deg, #121a2a 0%, ${CARD} 42%, #060912 100%), repeating-linear-gradient(-50deg, rgba(255,255,255,0.028) 0, rgba(255,255,255,0.028) 1px, transparent 1px, transparent 8px)`,
                }}
              >
                <TicketSideNotches tone={t.status === "expired" ? "red" : "gold"} />

                <div className="relative z-1 pl-[18px] pr-4 sm:pr-5 pt-4 sm:pt-5 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-white/40">
                      {t.id}
                    </p>
                    <span className="text-[8px] font-bold uppercase tracking-[0.32em] text-white/20">Ingresso</span>
                  </div>
                  <div className="mt-2.5 flex items-start justify-between gap-3">
                    <h2 className="min-w-0 flex-1 text-[20px] font-extrabold text-white leading-[1.15] tracking-tight">
                      {t.label}
                    </h2>
                    <span
                      className="inline-flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold"
                      style={{
                        background: "rgba(177,235,11,0.08)",
                        border: "1px solid rgba(177,235,11,0.45)",
                        color: GOLD_LIGHT,
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                      }}
                    >
                      <PriceIcon />
                      {t.value}
                    </span>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        background: t.status === "expired" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.1)",
                        border: `1px solid ${t.status === "expired" ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.28)"}`,
                        color: t.status === "expired" ? "#FCA5A5" : "#86EFAC",
                      }}
                    >
                      {t.statusLabel}
                    </span>
                    <span className="text-[12px] text-white/30">·</span>
                    <span className="text-[12px] text-white/50 font-mono tabular-nums">{t.eventDate}</span>
                  </div>

                  <div
                    className="mt-4 flex rounded-[10px] px-4 py-3 gap-0"
                    style={{ background: "rgba(0,0,0,0.35)", border: "1px dashed rgba(177,235,11,0.28)" }}
                  >
                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-white/38">Ranking</p>
                      <p className="text-[22px] font-black mt-0.5 font-mono tabular-nums leading-none" style={{ color: GOLD }}>
                        #{t.ranking}
                      </p>
                    </div>
                    <div className="w-px shrink-0 self-stretch bg-white/10 mx-2 sm:mx-4" />
                    <div className="min-w-0 flex-1 text-center sm:text-right">
                      <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-white/38">Pontos</p>
                      <p className="text-[22px] font-black text-white mt-0.5 font-mono tabular-nums leading-none">
                        {t.points} <span className="text-[13px] font-bold text-white/45">pts</span>
                      </p>
                    </div>
                  </div>
                </div>

                <TicketPerforation tone={t.status === "expired" ? "red" : "gold"} />

                <div className="relative z-1 px-4 sm:px-5 pb-3">
                  <button
                    type="button"
                    onClick={() => setDetailsOpen((prev) => ({ ...prev, [t.id]: !open }))}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[12px] font-medium tracking-wide transition-colors hover:bg-white/5"
                    style={{
                      border: "1px dashed rgba(255,255,255,0.16)",
                      color: "rgba(255,255,255,0.55)",
                      background: "rgba(0,0,0,0.25)",
                    }}
                    aria-expanded={open}
                  >
                    {open ? "Ocultar detalhes" : "Ver mais detalhes"}
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      strokeWidth={2.5}
                    />
                  </button>

                  {open && (
                    <div
                      className="mt-2 rounded-[10px] px-3 py-3 space-y-2.5"
                      style={{ background: "rgba(0,0,0,0.28)", border: "1px dashed rgba(255,255,255,0.1)" }}
                    >
                      <TicketExtraRow label="Validade" value={t.valid} />
                      <TicketExtraRow label="Jogos" value={t.jogos} />
                      <TicketExtraRow label="Pontuação" value={t.janela} />
                      <TicketExtraRow label="Envio de palpites" value={t.limite} />
                    </div>
                  )}
                </div>

                <TicketPerforation tone={t.status === "expired" ? "red" : "gold"} />

                <div
                  className="relative z-1 px-4 sm:px-5 pt-1 pb-4 rounded-b-[13px]"
                  style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.45) 100%)" }}
                >

                  <div className="mt-3 flex flex-col items-center gap-3">
                    {t.status === "expired" ? (
                      <Link
                        href={`/palpites?ticket=${encodeURIComponent(t.id)}&mode=resultado`}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[10px] text-[12px] font-bold"
                        style={{ background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.45)", color: "#FCA5A5" }}
                      >
                        Ver resultado
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <Link
                        href={`/palpites?ticket=${encodeURIComponent(t.id)}`}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[10px] text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.12em] transition-transform hover:translate-x-0.5"
                        style={{
                          background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`,
                          color: "#0E141B",
                          boxShadow: "0 4px 20px rgba(177,235,11,0.25)",
                        }}
                      >
                        Continuar com ticket
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className="text-[12px] text-white/40 mt-4 text-center sm:text-left">
          Toque em um ticket para abrir os palpites.
        </p>
      </div>
    </div>
  );
}

export default function TicketsBoloesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen px-4 py-6 sm:px-6" />}>
      <TicketsBoloesPageContent />
    </Suspense>
  );
}
