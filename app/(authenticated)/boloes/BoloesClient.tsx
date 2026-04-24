"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Ticket } from "lucide-react";
import {
  isoDateToBR,
  palpitesUrlDiario,
  palpitesUrlPrincipal,
  type StoredTicket,
  type StoredTicketDiario,
  type StoredTicketGeral,
} from "@/app/(authenticated)/tickets/lib/ownedTicketsStorage";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FFE8BA";
const CARD = "#0A0E19";
const PAGE_BG = "var(--background)";

function TicketPerforation({ tone = "gold" as "gold" | "red" }) {
  const line = tone === "red" ? "rgba(248,113,113,0.45)" : "rgba(212,175,55,0.35)";
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

function TicketSideNotches({ tone = "gold" as "gold" | "red" }) {
  const ring = tone === "red" ? "rgba(248,113,113,0.4)" : "rgba(212,175,55,0.4)";
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

function formatTicketDate(createdAt: number): string {
  const iso = new Date(createdAt).toISOString().slice(0, 10);
  return isoDateToBR(iso);
}

function TicketMetaRow({
  statusLabel,
  statusStyle,
  dateLabel,
  dateTitle,
}: {
  statusLabel: string;
  statusStyle: { background: string; border: string; color: string };
  dateLabel: string;
  dateTitle: string;
}) {
  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-2">
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={statusStyle}
      >
        {statusLabel}
      </span>
      <span className="text-[12px] text-white/30">·</span>
      <span className="text-[12px] text-white/50 font-mono tabular-nums" title={dateTitle}>
        {dateLabel}
      </span>
    </div>
  );
}

export function BoloesClient({ tickets }: { tickets: StoredTicket[] }) {
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});

  const { gerais, diarios } = useMemo(() => {
    const g: StoredTicketGeral[] = [];
    const d: StoredTicketDiario[] = [];
    for (const t of tickets) {
      if (t.kind === "geral") g.push(t);
      else d.push(t);
    }
    return { gerais: g, diarios: d };
  }, [tickets]);

  return (
    <div className="min-h-screen px-4 sm:px-6 py-4">
      <div className="mx-auto w-full max-w-3xl">
        <section
          className="rounded-2xl border p-4 sm:p-5 mb-4"
          style={{ background: CARD, borderColor: "rgba(212, 175, 55, 0.25)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
            Meus Bolões
          </p>
          <h1 className="text-[30px] sm:text-[34px] font-black leading-none text-white">Seus Tickets</h1>
          <p className="text-[14px] mt-2 leading-relaxed text-white/55">
            Aqui você já vê seus tickets ativos e entra direto para palpitar.
          </p>
        </section>

        {tickets.length === 0 && (
          <section
            className="rounded-2xl border p-5 sm:p-6"
            style={{ background: CARD, borderColor: "rgba(255,255,255,0.10)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.32)" }}
              >
                <Ticket className="w-5 h-5" style={{ color: GOLD_LIGHT }} />
              </div>
              <div className="min-w-0">
                <p className="text-[17px] font-bold text-white">Você ainda não tem tickets</p>
                <p className="text-[13px] mt-1 text-white/55">
                  Para participar do bolão, você precisa adquirir pelo menos um ticket.
                </p>
                <Link
                  href="/tickets"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-bold"
                  style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`, color: "#0E141B" }}
                >
                  Adquirir ticket
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-6">
          {gerais.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/45">Bolão Principal</h2>
              <div className={gerais.length > 1 ? "flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 pr-8" : "space-y-3.5"}>
                {gerais.map((t) => {
                  const label = `Ticket Copa #${t.id.slice(-3)}`;
                  const value = "R$ 50,00";
                  const open = detailsOpen[t.id] ?? false;
                  const ticketDate = formatTicketDate(t.createdAt);
                  const detailsLine = "Status do ticket: ativo até a final da Copa (encerra somente no fim da competição).";
                  const actionHref = palpitesUrlPrincipal(t.id);
                  const principalStatusStyle = {
                    background: "rgba(34,197,94,0.1)",
                    border: "1px solid rgba(34,197,94,0.28)",
                    color: "#86EFAC",
                  };

                  return (
                    <article
                      key={t.id}
                      className={`relative rounded-[14px] ${gerais.length > 1 ? "snap-start shrink-0 w-[calc(100%-28px)] sm:w-[calc(100%-52px)]" : ""}`}
                      style={{
                        border: "1px solid rgba(212,175,55,0.45)",
                        boxShadow: "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
                        background:
                          "linear-gradient(165deg, #121a2a 0%, #0A0E19 42%, #060912 100%), repeating-linear-gradient(-50deg, rgba(255,255,255,0.028) 0, rgba(255,255,255,0.028) 1px, transparent 1px, transparent 8px)",
                      }}
                    >
                      <TicketSideNotches />
                      <div className="relative z-1 pl-[18px] pr-4 sm:pr-5 pt-4 sm:pt-5 pb-3">
                        <TicketMetaRow
                          statusLabel="Ativo até a final"
                          statusStyle={principalStatusStyle}
                          dateLabel={`Comprado em ${ticketDate}`}
                          dateTitle={`Ticket comprado em ${ticketDate}`}
                        />
                        <div
                          className="mt-4 flex rounded-[10px] px-4 py-3 gap-0"
                          style={{ background: "rgba(0,0,0,0.35)", border: "1px dashed rgba(212,175,55,0.28)" }}
                        >
                          <div className="min-w-0 flex-1 text-center sm:text-left">
                            <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-white/38">Ranking</p>
                            <p className="text-[22px] font-black mt-0.5 font-mono tabular-nums leading-none" style={{ color: GOLD }}>
                              #--
                            </p>
                          </div>
                          <div className="w-px shrink-0 self-stretch bg-white/10 mx-2 sm:mx-4" />
                          <div className="min-w-0 flex-1 text-center sm:text-right">
                            <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-white/38">Pontos</p>
                            <p className="text-[22px] font-black text-white mt-0.5 font-mono tabular-nums leading-none">
                              -- <span className="text-[13px] font-bold text-white/45">pts</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <TicketPerforation />
                      <div className="relative z-1 px-4 sm:px-5 pb-3">
                        <button
                          type="button"
                          onClick={() => setDetailsOpen((prev) => ({ ...prev, [t.id]: !open }))}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[12px] font-medium tracking-wide transition-colors hover:bg-white/5"
                          style={{ border: "1px dashed rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.25)" }}
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
                            className="mt-2 rounded-[10px] px-3 py-3 space-y-2.5 text-[12px]"
                            style={{ background: "rgba(0,0,0,0.28)", border: "1px dashed rgba(255,255,255,0.1)" }}
                          >
                            <p className="text-white/70">{detailsLine}</p>
                            <p className="text-white/50">ID do ticket: {t.id}</p>
                          </div>
                        )}
                      </div>
                      <TicketPerforation />
                      <div
                        className="relative z-1 px-4 sm:px-5 pt-1 pb-4 rounded-b-[13px]"
                        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.45) 100%)" }}
                      >
                        <div className="mt-3 flex flex-col items-center gap-3">
                          <Link
                            href={actionHref}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[10px] text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.12em] transition-transform hover:translate-x-0.5"
                            style={{
                              background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`,
                              color: "#0E141B",
                              boxShadow: "0 4px 20px rgba(212,175,55,0.25)",
                            }}
                          >
                            Continuar com ticket
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {diarios.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/45">Bolão Diário</h2>
              <div className={diarios.length > 1 ? "flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 pr-8" : "space-y-3.5"}>
                {diarios.map((t) => {
                  const isDiario = t.kind === "diario";
                  const label = isDiario ? `Ticket Diário #${t.id.slice(-3)}` : `Ticket Copa #${t.id.slice(-3)}`;
                  const value = isDiario ? "R$ 25,00" : "R$ 50,00";
                  const open = detailsOpen[t.id] ?? false;
                  const ticketDate = isDiario ? (t.playDate ?? formatTicketDate(t.createdAt)) : formatTicketDate(t.createdAt);
                  const dailyStatus = isDiario ? (t.dailyStatus ?? "disponivel") : null;
                  const detailsLine = isDiario
                    ? "Válido apenas para os jogos do dia escolhido."
                    : "Válido da abertura até a final da Copa.";
                  const actionHref =
                    isDiario
                      ? dailyStatus === "usado"
                        ? `${palpitesUrlDiario(t.id)}&mode=resultado`
                        : palpitesUrlDiario(t.id)
                      : palpitesUrlPrincipal(t.id);
                  const dailyStatusLabel =
                    dailyStatus === "usado" ? "Usado" : dailyStatus === "em_uso" ? "Em uso" : "Disponível";
                  const dailyStatusStyle =
                    dailyStatus === "usado"
                      ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", color: "#FCA5A5" }
                      : dailyStatus === "em_uso"
                        ? { background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.28)", color: "#93C5FD" }
                        : { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.28)", color: "#86EFAC" };

                  return (
                    <article
                      key={t.id}
                      className={`relative rounded-[14px] ${diarios.length > 1 ? "snap-start shrink-0 w-[calc(100%-28px)] sm:w-[calc(100%-52px)]" : ""}`}
                      style={{
                        border: "1px solid rgba(212,175,55,0.45)",
                        boxShadow: "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
                        background:
                          "linear-gradient(165deg, #121a2a 0%, #0A0E19 42%, #060912 100%), repeating-linear-gradient(-50deg, rgba(255,255,255,0.028) 0, rgba(255,255,255,0.028) 1px, transparent 1px, transparent 8px)",
                      }}
                    >
                      <TicketSideNotches />
                      <div className="relative z-1 pl-[18px] pr-4 sm:pr-5 pt-4 sm:pt-5 pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-white/40">{t.id}</p>
                          <span className="text-[8px] font-bold uppercase tracking-[0.32em] text-white/20">Ingresso</span>
                        </div>
                        <div className="mt-2.5 flex items-start justify-between gap-3">
                          <h2 className="min-w-0 flex-1 text-[20px] font-extrabold text-white leading-[1.15] tracking-tight">{label}</h2>
                          <span
                            className="inline-flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold"
                            style={{
                              background: "rgba(212,175,55,0.08)",
                              border: "1px solid rgba(212,175,55,0.45)",
                              color: GOLD_LIGHT,
                            }}
                          >
                            {value}
                          </span>
                        </div>
                        <TicketMetaRow
                          statusLabel={isDiario ? dailyStatusLabel : "Ativo e elegível"}
                          statusStyle={
                            isDiario
                              ? dailyStatusStyle
                              : { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.28)", color: "#86EFAC" }
                          }
                          dateLabel={`Dia ${ticketDate}`}
                          dateTitle={`Ticket válido para ${ticketDate}`}
                        />
                        <div
                          className="mt-4 flex rounded-[10px] px-4 py-3 gap-0"
                          style={{ background: "rgba(0,0,0,0.35)", border: "1px dashed rgba(212,175,55,0.28)" }}
                        >
                          <div className="min-w-0 flex-1 text-center sm:text-left">
                            <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-white/38">Ranking</p>
                            <p className="text-[22px] font-black mt-0.5 font-mono tabular-nums leading-none" style={{ color: GOLD }}>
                              #--
                            </p>
                          </div>
                          <div className="w-px shrink-0 self-stretch bg-white/10 mx-2 sm:mx-4" />
                          <div className="min-w-0 flex-1 text-center sm:text-right">
                            <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-white/38">Pontos</p>
                            <p className="text-[22px] font-black text-white mt-0.5 font-mono tabular-nums leading-none">
                              -- <span className="text-[13px] font-bold text-white/45">pts</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <TicketPerforation />
                      <div className="relative z-1 px-4 sm:px-5 pb-3">
                        <button
                          type="button"
                          onClick={() => setDetailsOpen((prev) => ({ ...prev, [t.id]: !open }))}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[12px] font-medium tracking-wide transition-colors hover:bg-white/5"
                          style={{ border: "1px dashed rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.25)" }}
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
                            className="mt-2 rounded-[10px] px-3 py-3 space-y-2.5 text-[12px]"
                            style={{ background: "rgba(0,0,0,0.28)", border: "1px dashed rgba(255,255,255,0.1)" }}
                          >
                            <p className="text-white/70">{detailsLine}</p>
                            <p className="text-white/50">ID do ticket: {t.id}</p>
                          </div>
                        )}
                      </div>
                      <TicketPerforation />
                      <div
                        className="relative z-1 px-4 sm:px-5 pt-1 pb-4 rounded-b-[13px]"
                        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.45) 100%)" }}
                      >
                        <div className="mt-3 flex flex-col items-center gap-3">
                          <Link
                            href={actionHref}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[10px] text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.12em] transition-transform hover:translate-x-0.5"
                            style={{
                              background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`,
                              color: "#0E141B",
                              boxShadow: "0 4px 20px rgba(212,175,55,0.25)",
                            }}
                          >
                            {isDiario && dailyStatus === "usado"
                              ? "Ver resultado do ticket"
                              : isDiario && !t.playDate
                                ? "Escolher dia do ticket"
                                : "Continuar com ticket"}
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
