"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RANKING_BORDER,
  RANKING_LIVE_RED,
} from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";
import {
  formatRankingHistoricoLiveLabel,
  isRankingHistoricoLive,
  rankingHistoricoOutcomeLabel,
} from "@/lib/ranking/historico-display";
import type { RankingHistoricoRow } from "@/lib/ranking/historico-types";
import { rankingMatchDomId } from "@/lib/push/ranking-push-url";

const PANEL = "#101010";

function matchInput(row: RankingHistoricoRow) {
  return {
    matchStatus: row.matchStatus,
    kickoffAt: row.kickoffAt,
    jogoData: row.jogoData,
    jogoHora: row.jogoHora,
    resultadoCasa: row.resultadoCasa,
    resultadoVisitante: row.resultadoVisitante,
  };
}

function matchLiveState(row: RankingHistoricoRow, nowMs: number) {
  const input = matchInput(row);
  const live = row.aoVivo ?? isRankingHistoricoLive(input, nowMs);
  const liveClock = live
    ? row.liveLabel ?? formatRankingHistoricoLiveLabel(input, nowMs)
    : null;
  return { live, liveClock, input };
}

function TeamEscudo({ url, alt }: { url: string | null; alt: string }) {
  if (!url?.trim()) {
    return (
      <div
        className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-white/6 text-[11px] font-black uppercase text-white/35"
        aria-hidden
      >
        {alt.slice(0, 2)}
      </div>
    );
  }
  return (
    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white/96 p-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="size-8 object-contain"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

function ScoreCell({
  label,
  home,
  away,
  muted,
}: {
  label: string;
  home: number | string;
  away: number | string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-[5rem] flex-1 text-center">
      <p className="text-[11px] font-black uppercase tracking-widest text-white/45 min-[380px]:text-[12px]">
        {label}
      </p>
      <p
        className={`mt-1.5 text-[22px] font-black tabular-nums leading-none min-[380px]:text-[24px] ${
          muted ? "text-white/35" : "text-white"
        }`}
      >
        {home}
        <span className="mx-0.5 font-bold text-white/25">×</span>
        {away}
      </p>
    </div>
  );
}

function MatchResultRow({
  row,
  nowMs,
  highlighted,
}: {
  row: RankingHistoricoRow;
  nowMs: number;
  highlighted?: boolean;
}) {
  const { live, liveClock, input } = matchLiveState(row, nowMs);
  const hasResult =
    row.resultadoCasa != null && row.resultadoVisitante != null;
  const showResult = hasResult || live;
  const outcome = rankingHistoricoOutcomeLabel(
    { ...input, aoVivo: live, exact: row.exact, pontos: row.pontos },
    nowMs,
  );

  const pointsText = hasResult
    ? row.pontos > 0
      ? `+${row.pontos}`
      : "0"
    : live
      ? "…"
      : "—";

  return (
    <li
      id={rankingMatchDomId(row.matchId)}
      className={`border-b border-white/[0.07] px-4 py-4 last:border-b-0 min-[380px]:px-4 min-[380px]:py-5 scroll-mt-28 transition-colors ${
        highlighted
          ? "bg-primary/10 ring-2 ring-inset ring-primary/55"
          : ""
      }`}
    >
      {/* Linha 1 — times */}


      {/* Linha 2 — data e ao vivo */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[12px] font-semibold text-white/50 min-[380px]:text-[13px]">
          {row.jogoData} · {row.jogoHora}
        </p>
        {live && liveClock ? (
          <p
            className="inline-flex items-center gap-1.5 text-[12px] font-black uppercase min-[380px]:text-[13px]"
            style={{ color: RANKING_LIVE_RED }}
            role="status"
            aria-live="polite"
          >
            <span
              className="size-1.5 shrink-0 animate-pulse rounded-full"
              style={{ background: RANKING_LIVE_RED }}
              aria-hidden
            />
            <span>Ao vivo</span>
            <span className="font-semibold normal-case opacity-85">
              · {liveClock}
            </span>
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5">
        <TeamEscudo url={row.escudoMandante} alt={row.mandante} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black leading-snug text-white min-[380px]:text-[16px]">
            {row.mandante}
            <span className="mx-1.5 font-semibold text-white/40">vs</span>
            {row.visitante}
          </p>
        </div>
        <TeamEscudo url={row.escudoVisitante} alt={row.visitante} />
      </div>


      {/* Linha 3 — palpite, resultado, pontos */}
      <div className="mt-3.5 flex items-end justify-between gap-2">
        <div className="flex flex-1 items-end justify-center gap-3 min-[380px]:gap-5">
          <ScoreCell
            label="Palpite"
            home={row.palpiteCasa}
            away={row.palpiteVisitante}
          />
          <ScoreCell
            label="Resultado"
            home={showResult ? row.resultadoCasa! : "—"}
            away={showResult ? row.resultadoVisitante! : "—"}
            muted={!showResult}
          />
        </div>
        <div className="w-[4.25rem] shrink-0 pb-0.5 text-right min-[380px]:w-[4.5rem]">
          <p className="text-[11px] font-black uppercase tracking-widest text-white/45 min-[380px]:text-[12px]">
            Pontos
          </p>
          <p
            className={`mt-1.5 text-[22px] font-black tabular-nums leading-none min-[380px]:text-[24px] ${
              hasResult && row.pontos > 0
                ? "text-primary"
                : live
                  ? "text-white/50"
                  : "text-white/35"
            }`}
          >
            {pointsText}
          </p>
        </div>
      </div>

      {/* Linha 4 — situação */}
      <p
        className={`mt-3 text-[12px] font-black uppercase text-center tracking-wide min-[380px]:text-[13px] ${
          live || (hasResult && row.pontos > 0)
            ? "text-primary"
            : "text-white/45"
        }`}
      >
        {outcome}
      </p>
    </li>
  );
}

export function RankingBoardMatchResults({
  matches,
  loading,
  refreshClockMs,
  highlightMatchId,
}: {
  matches: RankingHistoricoRow[];
  loading: boolean;
  refreshClockMs?: number;
  highlightMatchId?: string | null;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const normalizedHighlight = highlightMatchId?.trim() || null;

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const aLive = matchLiveState(a, nowMs).live ? 1 : 0;
      const bLive = matchLiveState(b, nowMs).live ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      const da = a.jogoData?.split("/").reverse().join("") ?? "";
      const db = b.jogoData?.split("/").reverse().join("") ?? "";
      if (da !== db) return da.localeCompare(db);
      return (a.jogoHora ?? "").localeCompare(b.jogoHora ?? "");
    });
  }, [matches, nowMs]);

  const hasAnyLive = sortedMatches.some((m) => matchLiveState(m, nowMs).live);

  useEffect(() => {
    setNowMs(Date.now());
  }, [refreshClockMs, matches]);

  useEffect(() => {
    if (!hasAnyLive) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [hasAnyLive]);

  useEffect(() => {
    if (!normalizedHighlight || loading || sortedMatches.length === 0) return;
    const target = document.getElementById(rankingMatchDomId(normalizedHighlight));
    if (!target) return;
    const id = window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(id);
  }, [normalizedHighlight, loading, sortedMatches.length]);

  return (
    <section aria-label="Resultados das partidas e seus palpites">
      <div className="mb-3 px-0.5">
        <h2 className="text-[14px] font-black uppercase tracking-[0.12em] text-white min-[380px]:text-[15px]">
          Resultados das partidas
        </h2>
        <p className="mt-1 text-[13px] font-medium text-white/50 min-[380px]:text-[14px]">
          Seus palpites neste bolão
        </p>
      </div>

      <div
        className="overflow-hidden rounded-2xl border"
        style={{ background: PANEL, borderColor: RANKING_BORDER }}
      >
        {loading ? (
          <div className="animate-pulse" aria-hidden>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="border-b border-white/[0.07] px-4 py-5 last:border-b-0"
              >
                <div className="h-10 rounded-lg bg-white/6" />
                <div className="mt-3 h-8 w-2/3 rounded-lg bg-white/4" />
              </div>
            ))}
          </div>
        ) : sortedMatches.length === 0 ? (
          <p className="px-4 py-8 text-center text-[15px] font-medium text-white/60">
            Nenhum palpite enviado neste bolão ainda.
          </p>
        ) : (
          <ul>
            {sortedMatches.map((row) => (
              <MatchResultRow
                key={`${row.ticketId}-${row.matchId}`}
                row={row}
                nowMs={nowMs}
                highlighted={
                  normalizedHighlight != null &&
                  String(row.matchId) === normalizedHighlight
                }
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
