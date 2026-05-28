"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import {
  matchKickoffMs,
  type PalpiteAbertoMatch,
} from "@/lib/home-palpites-abertos";

export type { PalpiteAbertoMatch };

const GREEN = "#B1EB0B";
const CARD_BG = "#111111";

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
    month: "2-digit",
  })
    .format(target)
    .replace(".", "")
    .toUpperCase();
}

function teamDisplaySlug(
  team: PalpiteAbertoMatch["time_mandante"],
): string {
  const sigla = team.sigla?.trim();
  if (sigla) return sigla.toUpperCase();
  const popular = team.nome_popular?.trim();
  if (popular) return popular.slice(0, 3).toUpperCase();
  return "---";
}

function TeamLogoBox({
  team,
}: {
  team: PalpiteAbertoMatch["time_mandante"];
}) {
  const sigla = teamDisplaySlug(team);
  return (
    <span className="flex size-[56px] items-center justify-center rounded-[12px] bg-white p-2">
      {team.escudo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.escudo}
          alt=""
          className="size-full object-contain"
          draggable={false}
        />
      ) : (
        <span className="text-[13px] font-black text-[#0E141B]">{sigla}</span>
      )}
    </span>
  );
}

function PalpiteAbertoCard({ match }: { match: PalpiteAbertoMatch }) {
  const dayLabel = matchDayLabel(match);
  const time = match.hora_realizacao?.slice(0, 5) || "--:--";

  return (
    <article
      className="flex min-w-0 flex-col rounded-[16px] px-3 pb-3 pt-3"
      style={{ backgroundColor: CARD_BG }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-black uppercase tracking-wide text-primary">
          {dayLabel}
        </span>
        <span className="flex items-center gap-1.5 text-[13px] font-bold tabular-nums text-white">
          <Clock className="size-4 shrink-0 opacity-90" strokeWidth={2.4} aria-hidden />
          {time}
        </span>
      </div>

      <div className="mt-3 flex items-start justify-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <TeamLogoBox team={match.time_mandante} />
          <span className="text-[14px] font-black leading-none text-white">
            {teamDisplaySlug(match.time_mandante)}
          </span>
        </div>

        <span
          className="mt-5 shrink-0 px-1 text-[15px] font-black leading-none text-white"
          aria-hidden
        >
          X
        </span>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <TeamLogoBox team={match.time_visitante} />
          <span className="text-[14px] font-black leading-none text-white">
            {teamDisplaySlug(match.time_visitante)}
          </span>
        </div>
      </div>

      <Link
        href="/boloes"
        className="mt-4 flex h-10 w-full items-center justify-center rounded-[11px] bg-primary text-[12px] font-black uppercase tracking-[0.02em] text-[#0E141B] transition-transform active:scale-[0.98] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Fazer palpite
      </Link>
    </article>
  );
}

function PalpitesAbertosSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-[172px] animate-pulse rounded-[16px] bg-white/8"
          aria-hidden
        />
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
  return (
    <section className={className} aria-labelledby="palpites-abertos-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="palpites-abertos-heading"
          className="text-[15px] font-black uppercase tracking-[0.04em] text-white"
        >
          PALPITES ABERTOS
        </h2>
        <Link
          href="/boloes"
          className="shrink-0 text-[13px] font-black uppercase tracking-wide transition-opacity hover:opacity-90"
          style={{ color: GREEN }}
        >
          VER TODOS &gt;
        </Link>
      </div>

      {loading ? (
        <PalpitesAbertosSkeleton />
      ) : matches.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
          {matches.map((match) => (
            <PalpiteAbertoCard
              key={`${match.competition_id ?? 0}-${match.partida_id}`}
              match={match}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-primary/20 bg-primary/[0.07] p-4 text-center">
          <p className="text-[14px] font-black uppercase text-white">
            Nenhum palpite aberto agora
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
