"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

function MetaIcon({ kind }: { kind: "status" | "jogos" | "janela" | "limite" | "value" }) {
  if (kind === "status") {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" aria-hidden>
        <circle cx="10" cy="10" r="7" fill="none" stroke={GOLD} strokeWidth="1.8" />
        <path d="M7 10.2l2 2 4-4" fill="none" stroke={GOLD_LIGHT} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "jogos") {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" aria-hidden>
        <rect x="3" y="4" width="14" height="12" rx="2" fill="none" stroke={GOLD} strokeWidth="1.6" />
        <path d="M7 10h6M10 7v6" stroke={GOLD_LIGHT} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "janela") {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" aria-hidden>
        <circle cx="10" cy="10" r="7" fill="none" stroke={GOLD} strokeWidth="1.6" />
        <path d="M10 6v4l3 2" fill="none" stroke={GOLD_LIGHT} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "limite") {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" aria-hidden>
        <path d="M10 3l6 3v4c0 3.5-2.4 5.9-6 7-3.6-1.1-6-3.5-6-7V6l6-3Z" fill="none" stroke={GOLD} strokeWidth="1.6" />
        <path d="M10 7v3.8" stroke={GOLD_LIGHT} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" aria-hidden>
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
      jogos: "Todos os jogos da Copa",
      janela: "Pontua rodada a rodada",
      limite: "1 envio por partida",
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
      jogos: "Todos os jogos da Copa",
      janela: "Pontua rodada a rodada",
      limite: "1 envio por partida",
      eventDate: "13/06/2026",
      ranking: 33,
      points: 136,
    },
    {
      id: "CP-2026-003",
      label: "Ticket Copa #003",
      value: "R$ 49,00",
      valid: "Jogo encerrado",
      status: "expired",
      statusLabel: "Partida ja encerrada",
      jogos: "Todos os jogos da Copa",
      janela: "Pontua rodada a rodada",
      limite: "1 envio por partida",
      eventDate: "05/06/2026",
      ranking: 52,
      points: 119,
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
      jogos: "Jogos do dia (4 partidas)",
      janela: "Fecha antes do 1º jogo",
      limite: "1 envio para o dia",
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
      jogos: "Jogos do dia (4 partidas)",
      janela: "Fecha antes do 1º jogo",
      limite: "1 envio para o dia",
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
      jogos: "Jogos do dia (4 partidas)",
      janela: "Fecha antes do 1º jogo",
      limite: "1 envio para o dia",
      eventDate: "24/03/2026",
      ranking: 29,
      points: 17,
    },
  ] satisfies TicketItem[],
} as const;

export default function TicketsBoloesPage() {
  const search = useSearchParams();
  const bolao = search.get("bolao") === "diario" ? "diario" : "principal";
  const tickets = TICKETS[bolao];
  const title = bolao === "principal" ? "Bolão Principal" : "Bolão Diário";
  const subtitle =
    bolao === "principal"
      ? "Selecione um ticket para seguir para os palpites da Copa inteira."
      : "Selecione um ticket para seguir para os palpites dos jogos de hoje.";

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
          {tickets.map((t) => (
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
                  <MetaIcon kind="value" />
                  {t.value}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  className="rounded-lg px-2.5 py-2 border flex items-center gap-1.5 text-[12px]"
                  style={{
                    borderColor: t.status === "expired" ? "rgba(239,68,68,0.32)" : "rgba(255,255,255,0.12)",
                    background: t.status === "expired" ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
                    color: t.status === "expired" ? "#FCA5A5" : "rgba(255,255,255,0.8)",
                  }}
                >
                  <MetaIcon kind="status" />
                  {t.statusLabel}
                </div>
                <div className="rounded-lg px-2.5 py-2 border flex items-center gap-1.5 text-[12px] text-white/80" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
                  <MetaIcon kind="jogos" />
                  {t.jogos}
                </div>
                <div className="rounded-lg px-2.5 py-2 border flex items-center gap-1.5 text-[12px] text-white/80" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
                  <MetaIcon kind="janela" />
                  {t.janela}
                </div>
                <div className="rounded-lg px-2.5 py-2 border flex items-center gap-1.5 text-[12px] text-white/80" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
                  <MetaIcon kind="limite" />
                  {t.limite}
                </div>
                <div className="rounded-lg px-2.5 py-2 border flex items-center gap-1.5 text-[12px] text-white/80" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
                  <MetaIcon kind="status" />
                  Ranking atual: <strong className="text-white">#{t.ranking}</strong>
                </div>
                <div className="rounded-lg px-2.5 py-2 border flex items-center gap-1.5 text-[12px] text-white/80" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
                  <MetaIcon kind="value" />
                  Pontos ganhos: <strong className="text-white">{t.points} pts</strong>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/75">
                <MetaIcon kind="janela" />
                {t.valid}
                <span className="text-white/30">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <MetaIcon kind="jogos" />
                  Dia do evento: <strong className="text-white font-semibold">{t.eventDate}</strong>
                </span>
              </div>

              <div className="mt-4 flex justify-end">
                {t.status === "expired" ? (
                  <Link
                    href={`/palpites?bolao=${bolao}&ticket=${t.id}&eventDate=${encodeURIComponent(
                      t.eventDate
                    )}&mode=resultado&ranking=${t.ranking}&points=${t.points}`}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-bold"
                    style={{ background: "rgba(239,68,68,0.16)", border: "1px solid rgba(239,68,68,0.35)", color: "#FCA5A5" }}
                  >
                    Ver resultado da partida
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link
                    href={`/palpites?bolao=${bolao}&ticket=${t.id}&eventDate=${encodeURIComponent(
                      t.eventDate
                    )}&ranking=${t.ranking}&points=${t.points}`}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-bold transition-transform hover:translate-x-0.5"
                    style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`, color: "#0E141B" }}
                  >
                    Continuar com ticket
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>

        <p className="text-[12px] text-white/45 mt-4 flex items-center gap-1.5">
          <MetaIcon kind="status" />
          Selecione um ticket para seguir ao passo final de palpites.
        </p>
      </div>
    </div>
  );
}
