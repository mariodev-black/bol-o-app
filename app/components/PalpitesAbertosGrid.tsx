"use client";

import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import {
  matchKickoffMs,
  type PalpiteAbertoMatch,
} from "@/lib/home-palpites-abertos";
import {
  resolvePartidaTeamDisplay,
  teamEscudoFallbackLabel,
} from "@/lib/partida-team-display";

export type { PalpiteAbertoMatch };

const GREEN = "#B1EB0B";
const CARD_BG = "#111111";
const MAX_MATCHES = 15;
/** Mobile mostra poucas (normal); desktop mostra todas (até MAX_MATCHES). */
const MOBILE_LIMIT = 5;

function matchDayLabel(match: PalpiteAbertoMatch): string {
  const ms = matchKickoffMs(match);
  if (!Number.isFinite(ms) || ms === Number.MAX_SAFE_INTEGER) {
    return (match.data_realizacao || "EM BREVE").toUpperCase();
  }
  const today = new Date();
  const target = new Date(ms);
  const sameDay =
    today.getFullYear() === target.getFullYear() &&
    today.getMonth() === target.getMonth() &&
    today.getDate() === target.getDate();
  if (sameDay) return "HOJE";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .format(target)
    .replace(/\./g, "")
    .toUpperCase();
}

function teamName(team: PalpiteAbertoMatch["time_mandante"]): string {
  const display = resolvePartidaTeamDisplay(team);
  if (display.isKnockoutSlot) {
    return display.slotDetail ?? display.nome;
  }
  return display.nome;
}

function TeamFlag({ team }: { team: PalpiteAbertoMatch["time_mandante"] }) {
  const display = resolvePartidaTeamDisplay(team);
  return (
    <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
      {display.escudo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={display.escudo}
          alt=""
          className="size-full object-contain p-0.5"
          draggable={false}
        />
      ) : (
        <span className="text-[9px] font-black text-[#0E141B]">
          {teamEscudoFallbackLabel(team.sigla, team.nome_popular)}
        </span>
      )}
    </span>
  );
}

function MatchRow({
  match,
  hiddenOnMobile,
}: {
  match: PalpiteAbertoMatch;
  hiddenOnMobile?: boolean;
}) {
  const time = match.hora_realizacao?.slice(0, 5) || "--:--";
  return (
    <Link
      href="/palpites"
      className={`${hiddenOnMobile ? "hidden lg:flex" : "flex"} items-center gap-3 px-3.5 py-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TeamFlag team={match.time_mandante} />
          <span className="truncate text-[13.5px] font-bold leading-tight text-white">
            {teamName(match.time_mandante)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <TeamFlag team={match.time_visitante} />
          <span className="truncate text-[13.5px] font-bold leading-tight text-white">
            {teamName(match.time_visitante)}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold tabular-nums text-white/45">
          <Clock className="size-3.5 shrink-0" strokeWidth={2.4} aria-hidden />
          {time}
        </div>
      </div>

      <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[10px] bg-primary pl-3 pr-2 text-[11.5px] font-black uppercase tracking-[0.02em] text-[#0E141B]">
        Palpitar
        <ChevronRight className="size-4" strokeWidth={2.6} aria-hidden />
      </span>
    </Link>
  );
}

type DayGroup = {
  label: string;
  items: PalpiteAbertoMatch[];
  /** Índice global do 1º jogo do grupo (para cortar no mobile). */
  startIndex: number;
};

function groupByDay(matches: PalpiteAbertoMatch[]): DayGroup[] {
  const sorted = [...matches]
    .sort((a, b) => matchKickoffMs(a) - matchKickoffMs(b))
    .slice(0, MAX_MATCHES);
  const groups: DayGroup[] = [];
  for (const m of sorted) {
    const label = matchDayLabel(m);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m);
    else groups.push({ label, items: [m], startIndex: 0 });
  }
  let acc = 0;
  for (const g of groups) {
    g.startIndex = acc;
    acc += g.items.length;
  }
  return groups;
}

function PalpitesAbertosSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-[16px]"
      style={{ backgroundColor: CARD_BG }}
      aria-hidden
    >
      <div className="h-9 animate-pulse bg-white/8" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[76px] animate-pulse border-t border-white/5 bg-white/[0.03]" />
      ))}
    </div>
  );
}

export function PalpitesAbertosGrid({
  matches,
  loading,
  className = "mt-5",
}: {
  matches: PalpiteAbertoMatch[];
  loading: boolean;
  className?: string;
}) {
  const groups = groupByDay(matches);

  return (
    <section className={className} aria-labelledby="palpites-abertos-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="palpites-abertos-heading"
          className="text-[15px] font-black uppercase tracking-[0.04em] text-white"
        >
          PRÓXIMAS PARTIDAS
        </h2>
        <Link
          href="/palpites"
          className="shrink-0 text-[13px] font-black uppercase tracking-wide transition-opacity hover:opacity-90"
          style={{ color: GREEN }}
        >
          VER TODOS &gt;
        </Link>
      </div>

      {loading ? (
        <PalpitesAbertosSkeleton />
      ) : groups.length > 0 ? (
        <div
          className="overflow-hidden rounded-[16px] border border-white/8"
          style={{ backgroundColor: CARD_BG }}
        >
          {groups.map((group) => (
            <div
              key={group.label}
              className={group.startIndex >= MOBILE_LIMIT ? "hidden lg:block" : undefined}
            >
              <div className="flex items-center justify-between bg-white/[0.06] px-3.5 py-2">
                <span className="text-[11px] font-black uppercase tracking-[0.08em] text-white/70">
                  {group.label}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/35">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "jogo" : "jogos"}
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {group.items.map((match, i) => (
                  <MatchRow
                    key={`${match.competition_id ?? 0}-${match.partida_id}`}
                    match={match}
                    hiddenOnMobile={group.startIndex + i >= MOBILE_LIMIT}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-primary/20 bg-primary/[0.07] p-4 text-center">
          <p className="text-[14px] font-black uppercase text-white">
            Nenhuma partida aberta agora
          </p>
          <p className="mx-auto mt-1 max-w-[260px] text-[12px] font-medium leading-snug text-white/55">
            Assim que liberar novas partidas, elas aparecem aqui.
          </p>
          <Link
            href="/boloes"
            className="mt-3 inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-4 text-[11px] font-black uppercase text-[#0E141B]"
          >
            Ver bolões
          </Link>
        </div>
      )}
    </section>
  );
}
