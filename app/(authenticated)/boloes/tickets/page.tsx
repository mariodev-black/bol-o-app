"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { StepsBreadcrumb } from "../_components/StepsBreadcrumb";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FFE8BA";
const CARD = "#0A0E19";

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
        background: "linear-gradient(150deg, rgba(255,232,186,0.16) 0%, rgba(212,175,55,0.06) 100%)",
        border: "1px solid rgba(212,175,55,0.34)",
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
      value: "R$ 49,00",
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
      value: "R$ 49,00",
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

function TicketsBoloesPageContent() {
  const search = useSearchParams();
  const bolao = search.get("bolao") === "diario" ? "diario" : "principal";
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

        <section className="rounded-2xl border p-4 sm:p-5 mb-4" style={{ background: CARD, borderColor: "rgba(212,175,55,0.24)" }}>
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
              className="rounded-2xl border p-4 sm:p-5"
              style={{
                background: CARD,
                borderColor: t.status === "expired" ? "rgba(239,68,68,0.35)" : "rgba(212,175,55,0.2)",
                opacity: t.status === "expired" ? 0.78 : 1,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.14em] font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {t.id}
                  </p>
                  <h2 className="text-[18px] font-extrabold text-white mt-1">{t.label}</h2>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0"
                  style={{ background: "rgba(212,175,55,0.14)", border: "1px solid rgba(212,175,55,0.32)", color: GOLD_LIGHT }}
                >
                  <PriceIcon />
                  {t.value}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={{
                    background: t.status === "expired" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.1)",
                    border: `1px solid ${t.status === "expired" ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.28)"}`,
                    color: t.status === "expired" ? "#FCA5A5" : "#86EFAC",
                  }}
                >
                  {t.statusLabel}
                </span>
                <span className="text-[12px] text-white/35">·</span>
                <span className="text-[12px] text-white/55">{t.eventDate}</span>
              </div>

              <div
                className="mt-3 flex rounded-xl px-3 py-2.5 gap-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-white/35">Ranking</p>
                  <p className="text-[17px] font-black mt-0.5" style={{ color: GOLD }}>
                    #{t.ranking}
                  </p>
                </div>
                <div className="w-px shrink-0 self-stretch my-0.5 bg-white/8" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-white/35">Pontos</p>
                  <p className="text-[17px] font-black text-white mt-0.5">{t.points} <span className="text-[12px] font-bold text-white/45">pts</span></p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailsOpen((prev) => ({ ...prev, [t.id]: !open }))}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold transition-colors hover:bg-white/6 hover:text-white/75"
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.55)",
                  background: "rgba(255,255,255,0.03)",
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
                  className="mt-2 rounded-xl px-3 py-3 space-y-2.5"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <TicketExtraRow label="Validade" value={t.valid} />
                  <TicketExtraRow label="Jogos" value={t.jogos} />
                  <TicketExtraRow label="Pontuação" value={t.janela} />
                  <TicketExtraRow label="Envio de palpites" value={t.limite} />
                </div>
              )}

              <div className="mt-4">
                {t.status === "expired" ? (
                  <Link
                    href={`/palpites?bolao=${bolao}&ticket=${t.id}&eventDate=${encodeURIComponent(
                      t.eventDate
                    )}&mode=resultado&ranking=${t.ranking}&points=${t.points}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-bold"
                    style={{ background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.35)", color: "#FCA5A5" }}
                  >
                    Ver resultado
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link
                    href={`/palpites?bolao=${bolao}&ticket=${t.id}&eventDate=${encodeURIComponent(
                      t.eventDate
                    )}&ranking=${t.ranking}&points=${t.points}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-bold transition-transform hover:translate-x-0.5"
                    style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`, color: "#0E141B" }}
                  >
                    Continuar com ticket
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
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
