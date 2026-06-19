"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart2, CalendarDays } from "lucide-react";
import { matchKickoffMs, type PalpiteAbertoMatch } from "@/lib/home-palpites-abertos";

const GREEN = "#B1EB0B";
const CARD_BG = "#111111";

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayTabLabel(ms: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(ms);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "HOJE";
  if (diffDays === 1) return "AMANHÃ";
  const wd = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(target)
    .replace(/\./g, "")
    .toUpperCase();
  const dm = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    target,
  );
  return `${wd} ${dm}`;
}

function teamName(team: PalpiteAbertoMatch["time_mandante"]): string {
  return team.nome_popular?.trim() || team.sigla?.trim()?.toUpperCase() || "A definir";
}

function TeamFlag({ team }: { team: PalpiteAbertoMatch["time_mandante"] }) {
  return (
    <span className="flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
      {team.escudo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.escudo} alt="" className="size-full object-contain p-0.5" draggable={false} />
      ) : (
        <span className="text-[8px] font-black text-[#0E141B]">
          {team.sigla?.slice(0, 3).toUpperCase() ?? "?"}
        </span>
      )}
    </span>
  );
}

function MatchRow({ match }: { match: PalpiteAbertoMatch }) {
  const time = match.hora_realizacao?.slice(0, 5) || "--:--";
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-[42px] shrink-0 text-[13px] font-bold tabular-nums text-white/55">
        {time}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TeamFlag team={match.time_mandante} />
        <span className="truncate text-[13px] font-bold text-white">
          {teamName(match.time_mandante)}
        </span>
        <span className="shrink-0 px-1 text-[11px] font-semibold text-white/30">x</span>
        <TeamFlag team={match.time_visitante} />
        <span className="truncate text-[13px] font-bold text-white">
          {teamName(match.time_visitante)}
        </span>
      </div>

      <Link
        href="/palpites"
        className="flex h-7 shrink-0 items-center rounded-[8px] px-3 text-[11px] font-black uppercase tracking-wide transition hover:brightness-110 active:scale-[0.98]"
        style={{ background: "rgba(177,235,11,0.12)", border: `1px solid ${GREEN}4D`, color: GREEN }}
      >
        Palpitar
      </Link>

      <Link
        href="/palpites-jogadores"
        className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-white/40 transition hover:bg-white/[0.06] hover:text-white/70"
        aria-label="Ver palpites da galera"
      >
        <BarChart2 className="size-[18px]" strokeWidth={2.1} aria-hidden />
      </Link>
    </div>
  );
}

export function PalpitesAbertosTable({
  matches,
  loading,
  className = "",
}: {
  matches: PalpiteAbertoMatch[];
  loading: boolean;
  className?: string;
}) {
  const days = useMemo(() => {
    const sorted = [...matches].sort((a, b) => matchKickoffMs(a) - matchKickoffMs(b));
    const map = new Map<string, { label: string; items: PalpiteAbertoMatch[] }>();
    for (const m of sorted) {
      const ms = matchKickoffMs(m);
      if (!Number.isFinite(ms) || ms === Number.MAX_SAFE_INTEGER) continue;
      const key = dayKey(ms);
      const entry = map.get(key) ?? { label: dayTabLabel(ms), items: [] };
      entry.items.push(m);
      map.set(key, entry);
    }
    return Array.from(map.values());
  }, [matches]);

  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = activeIdx < days.length ? activeIdx : 0;
  const activeDay = days[safeIdx];

  return (
    <section className={className} aria-labelledby="palpites-abertos-table-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="palpites-abertos-table-heading"
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

      <div
        className="overflow-hidden rounded-[16px] border border-white/8"
        style={{ backgroundColor: CARD_BG }}
      >
        {loading ? (
          <div className="space-y-px">
            <div className="h-11 animate-pulse bg-white/[0.06]" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[52px] animate-pulse bg-white/[0.02]" />
            ))}
          </div>
        ) : days.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-[14px] font-black uppercase text-white">
              Nenhuma partida aberta agora
            </p>
            <p className="mx-auto mt-1 max-w-[260px] text-[12px] font-medium leading-snug text-white/55">
              Assim que liberar novas partidas, elas aparecem aqui.
            </p>
          </div>
        ) : (
          <>
            {/* Abas de data */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/8 px-3 py-2.5">
              {days.map((day, i) => {
                const active = i === safeIdx;
                return (
                  <button
                    key={day.label}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className="shrink-0 rounded-[8px] px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors"
                    style={{
                      background: active ? "rgba(255,255,255,0.10)" : "transparent",
                      border: active ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
                      color: active ? "#FFFFFF" : "rgba(255,255,255,0.42)",
                    }}
                  >
                    {day.label}
                  </button>
                );
              })}
              <span className="ml-auto flex size-7 shrink-0 items-center justify-center text-white/40">
                <CalendarDays className="size-[18px]" strokeWidth={2} aria-hidden />
              </span>
            </div>

            {/* Linhas do dia ativo */}
            <div className="divide-y divide-white/5">
              {activeDay?.items.map((match) => (
                <MatchRow
                  key={`${match.competition_id ?? 0}-${match.partida_id}`}
                  match={match}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
