"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarClock, ChevronRight } from "lucide-react";
import { RankingBoardMatchResults } from "@/app/(authenticated)/ranking/_components/RankingBoardMatchResults";
import { RankingBoardPanel } from "@/app/(authenticated)/ranking/_components/RankingBoardPanel";
import {
  RANKING_BORDER,
  RANKING_CARD_BG,
} from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";
import type { PredictionBolaoType } from "@/lib/predictions";
import type { RankingBoardMeta, RankingBoardRow } from "@/lib/ranking/board-types";
import type { RankingHistoricoRow } from "@/lib/ranking/historico-types";
import { partidasUrlWithLiveSync } from "@/lib/football/live-sync-client";

type ResumoStats = {
  palpites: number;
  acertos: number;
  pontos: number;
  exatos: number;
};

function MyStatsFooter({ stats }: { stats: ResumoStats }) {
  const items = [
    { label: "Seus palpites", value: stats.palpites },
    { label: "Acertos", value: stats.acertos },
    { label: "Pontos", value: stats.pontos },
  ] as const;

  return (
    <section
      className="grid grid-cols-3 overflow-hidden rounded-2xl border"
      style={{ background: "#101010", borderColor: RANKING_BORDER }}
      aria-label="Seu desempenho neste bolão"
    >
      {items.map((item, idx) => (
        <div
          key={item.label}
          className={`py-4 text-center ${idx < 2 ? "border-r border-white/8" : ""}`}
        >
          <p className="text-[12px] font-black uppercase tracking-wide text-white/75">
            {item.label}
          </p>
          <p className="mt-2 text-[24px] font-black tabular-nums text-primary">
            {item.value}
          </p>
        </div>
      ))}
    </section>
  );
}

export function PalpitesRankingTab({
  ticketId,
  bolaoType,
  resumoStats,
  rows,
  meta,
  loading,
  error,
  lockBloco,
  onRankingLinkClick,
  liveRefreshKey,
}: {
  ticketId: string | null;
  bolaoType: PredictionBolaoType;
  resumoStats: ResumoStats;
  rows: RankingBoardRow[];
  meta: RankingBoardMeta | null;
  loading: boolean;
  error: string | null;
  lockBloco?: string;
  /** Bolão grátis: intercepta link "Ranking completo". */
  onRankingLinkClick?: () => void;
  /** Muda quando placares ao vivo atualizam (ex.: signature de partidas). */
  liveRefreshKey?: string;
}) {
  const [matchResults, setMatchResults] = useState<RankingHistoricoRow[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const pollMs = meta?.hasLiveMatchesInPool ? 15_000 : 30_000;
    const id = window.setInterval(() => setTick((t) => t + 1), pollMs);
    return () => window.clearInterval(id);
  }, [meta?.hasLiveMatchesInPool]);

  useEffect(() => {
    const historicoQ = new URLSearchParams();
    if (bolaoType === "principal") historicoQ.set("bolaoType", "principal");
    if (bolaoType === "diario" && ticketId) {
      historicoQ.set("bolaoType", "diario");
      historicoQ.set("ticketId", ticketId);
    }
    if (bolaoType === "extra" && ticketId) {
      historicoQ.set("bolaoType", "extra");
      historicoQ.set("ticketId", ticketId);
    }
    historicoQ.set("limit", "50");

    if (resumoStats.palpites < 1) {
      setMatchResults([]);
      return;
    }

    let cancelled = false;
    setLoadingMatches(true);
    void (async () => {
      try {
        if (meta?.hasLiveMatchesInPool) {
          await fetch(partidasUrlWithLiveSync("/api/partidas", { allSynced: 1 }), {
            cache: "no-store",
          }).catch(() => undefined);
        }
        const histResp = await fetch(
          `/api/palpites/historico?${historicoQ.toString()}`,
          { credentials: "include", cache: "no-store" },
        );
        const histData = (await histResp.json().catch(() => ({}))) as {
          historico?: RankingHistoricoRow[];
        };
        if (cancelled) return;
        if (!histResp.ok || !Array.isArray(histData.historico)) {
          setMatchResults([]);
          return;
        }
        setMatchResults(
          [...histData.historico].sort((a, b) => {
            const da = a.jogoData?.split("/").reverse().join("") ?? "";
            const db = b.jogoData?.split("/").reverse().join("") ?? "";
            if (da !== db) return da.localeCompare(db);
            return (a.jogoHora ?? "").localeCompare(b.jogoHora ?? "");
          }),
        );
      } catch {
        if (!cancelled) setMatchResults([]);
      } finally {
        if (!cancelled) setLoadingMatches(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bolaoType, ticketId, resumoStats.palpites, tick, liveRefreshKey, meta?.hasLiveMatchesInPool]);

  const topThree = useMemo(() => rows.slice(0, 3), [rows]);
  const rowsAfterPodium = useMemo(() => rows.slice(3), [rows]);
  const padTopThree = useMemo(
    () =>
      [topThree[0] ?? null, topThree[1] ?? null, topThree[2] ?? null] as const,
    [topThree],
  );
  const myRows = useMemo(() => rows.filter((r) => r.isMe), [rows]);
  const myRowsFooter = useMemo(
    () =>
      [...myRows]
        .filter((r) => r.pos > 10)
        .sort(
          (a, b) =>
            a.pos - b.pos ||
            String(a.ticketId).localeCompare(String(b.ticketId)),
        ),
    [myRows],
  );

  const awaitingRankingScores = useMemo(() => {
    if (loading || rows.length === 0) return false;
    const everyoneZero = rows.every(
      (r) => r.totalPoints === 0 && r.outcomeCount === 0,
    );
    if (!everyoneZero) return false;
    return meta?.hasResultedMatchesInPool !== true;
  }, [loading, rows, meta?.hasResultedMatchesInPool]);

  const provisionalRankingNote =
    awaitingRankingScores && rows.length > 0 ? (
      <div
        className="flex gap-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/6 px-3 py-2.5"
        role="status"
      >
        <CalendarClock
          className="mt-0.5 size-4 shrink-0 text-primary"
          strokeWidth={2}
          aria-hidden
        />
        <p className="text-[11px] font-medium leading-snug text-white/68">
          <span className="font-black text-white/88">Ordem provisória:</span>{" "}
          sem placar oficial ainda, a posição segue quem enviou palpite primeiro
          neste bolão.
        </p>
      </div>
    ) : null;

  const participants = meta?.participantCount ?? rows.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50">
          {participants.toLocaleString("pt-BR")} participantes
        </p>
        {ticketId ? (
          onRankingLinkClick ? (
            <button
              type="button"
              onClick={onRankingLinkClick}
              className="inline-flex items-center gap-0.5 text-[13px] font-bold text-primary hover:text-primary/85"
            >
              Ranking completo
              <ChevronRight className="size-4" strokeWidth={2.5} aria-hidden />
            </button>
          ) : (
            <Link
              href={`/ranking?default=${encodeURIComponent(ticketId)}`}
              className="inline-flex items-center gap-0.5 text-[13px] font-bold text-primary hover:text-primary/85"
            >
              Ranking completo
              <ChevronRight className="size-4" strokeWidth={2.5} aria-hidden />
            </Link>
          )
        ) : null}
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-center text-[14px] font-semibold text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div
          className="animate-pulse rounded-2xl border border-white/10 py-24"
          style={{ background: RANKING_CARD_BG }}
          aria-hidden
        />
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[15px] font-medium text-white/55">
          Ainda não há participantes neste bolão.
        </p>
      ) : (
        <>
          <RankingBoardPanel
            provisional={
              provisionalRankingNote ? (
                <div className="mb-3">{provisionalRankingNote}</div>
              ) : null
            }
            padTopThree={padTopThree}
            rowsAfterPodium={rowsAfterPodium}
            allRows={rows}
            myRowsFooter={myRowsFooter}
            totalCount={rows.length}
          />

          <RankingBoardMatchResults
            matches={matchResults}
            loading={loadingMatches}
            refreshClockMs={tick}
          />

          <MyStatsFooter stats={resumoStats} />

          {lockBloco ? (
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/6 px-4 py-4">
              <Bell
                className="mt-0.5 size-5 shrink-0 text-primary"
                strokeWidth={2}
                aria-hidden
              />
              <div>
                <p className="text-[13px] font-bold text-primary">
                  Prazo para palpitar
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/55">
                  {lockBloco}
                </p>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
