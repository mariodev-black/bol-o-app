"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, Ticket } from "lucide-react";
import {
  isoDateToBR,
  loadOwnedTicketsMerged,
  palpitesUrlDiario,
  palpitesUrlPrincipal,
  setDiarioTicketPlayDate,
  type StoredTicket,
  type StoredTicketDiario,
  type StoredTicketGeral,
} from "../lib/ownedTicketsStorage";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FFE8BA";
const CARD = "#0A0E19";
const montserrat = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";

type MyTicketsWalletProps = {
  refreshKey: number;
};

export function MyTicketsWallet({ refreshKey }: MyTicketsWalletProps) {
  const [tickets, setTickets] = useState<StoredTicket[]>([]);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void loadOwnedTicketsMerged().then((list) => {
      if (!cancelled) setTickets(list);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

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
    <div id="meus-tickets" className="space-y-3 mb-8 scroll-mt-24">

      {gerais.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Ticket geral · Copa inteira</p>
          {gerais.map((t) => (
            <WalletRow key={t.id}>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[12px] text-white/40 truncate">{t.id}</p>
                <p className="text-[15px] font-semibold text-white mt-0.5">Ativo na temporada</p>
                <p className="text-[13px] text-white/45 mt-0.5">Use em qualquer rodada da Copa no bolão principal.</p>
              </div>
              <Link
                href={palpitesUrlPrincipal(t.id)}
                className="shrink-0 inline-flex items-center gap-1 px-3.5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wide"
                style={{
                  background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`,
                  color: "#0E141B",
                }}
              >
                Palpites
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </WalletRow>
          ))}
        </div>
      )}

      {diarios.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Ticket do dia</p>
          {diarios.map((t) => (
            <DiarioTicketRow
              key={t.id}
              ticket={t}
              onLinked={() => void loadOwnedTicketsMerged().then(setTickets)}
              onNavigate={(path) => router.push(path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WalletRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl"
      style={{
        background: `linear-gradient(165deg, rgba(12,16,26,0.95) 0%, ${CARD} 100%)`,
        border: "1px solid rgba(212,175,55,0.18)",
      }}
    >
      {children}
    </div>
  );
}

function DiarioTicketRow({
  ticket,
  onLinked,
  onNavigate,
}: {
  ticket: Extract<StoredTicket, { kind: "diario" }>;
  onLinked: () => void;
  onNavigate: (path: string) => void;
}) {
  const [isoDate, setIsoDate] = useState("");

  const todayIso = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const goPalpitar = () => {
    if (!isoDate) return;
    const br = isoDateToBR(isoDate);
    if (!br) return;
    setDiarioTicketPlayDate(ticket.id, br);
    onLinked();
    onNavigate(palpitesUrlDiario(ticket.id));
  };

  if (ticket.playDate) {
    return (
      <WalletRow>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12px] text-white/40 truncate">{ticket.id}</p>
          <p className="text-[15px] font-semibold text-white mt-0.5 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-sky-300/90" />
            Dia: {ticket.playDate}
          </p>
          <p className="text-[13px] text-white/45 mt-0.5">Ticket amarrado a esta data — palpites contam só para os jogos do dia.</p>
        </div>
        <Link
          href={palpitesUrlDiario(ticket.id)}
          className="shrink-0 inline-flex items-center gap-1 px-3.5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wide"
          style={{
            background: "linear-gradient(180deg, rgba(147,197,253,0.25), rgba(59,130,246,0.35))",
            border: "1px solid rgba(96,165,250,0.45)",
            color: "#E0F2FE",
          }}
        >
          Abrir palpites
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </WalletRow>
    );
  }

  return (
    <WalletRow>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-mono text-[12px] text-white/40 truncate">{ticket.id}</p>
        <p className="text-[15px] font-semibold text-white">Ainda não amarrado a um dia</p>
        <p className="text-[13px] text-white/45 leading-relaxed">
          O ticket do dia só entra em jogo quando você escolhe a data e vai aos palpites. Um ticket = um dia de rodada.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-1">
          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-white/40">Dia da rodada</span>
            <input
              type="date"
              min={todayIso}
              value={isoDate}
              onChange={(e) => setIsoDate(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-[14px] text-white bg-black/40 border border-white/15 outline-none focus:border-amber-500/50"
            />
          </label>
          <button
            type="button"
            disabled={!isoDate}
            onClick={goPalpitar}
            className="px-4 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wide disabled:opacity-35 transition-opacity"
            style={{
              background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`,
              color: "#0E141B",
            }}
          >
            Palpitar neste dia
          </button>
        </div>
      </div>
    </WalletRow>
  );
}
