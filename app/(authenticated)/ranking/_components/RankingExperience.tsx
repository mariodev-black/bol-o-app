"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Ticket } from "lucide-react";
import { RankingBoardStep } from "@/app/(authenticated)/ranking/_components/RankingBoardStep";
import { RankingPalpitesStepsModal } from "@/app/(authenticated)/ranking/_components/RankingPalpitesStepsModal";
import { RankingPageHeader } from "@/app/(authenticated)/ranking/_components/RankingPageHeader";
import { RankingScopePicker } from "@/app/(authenticated)/ranking/_components/RankingScopePicker";
import { RankingFullPageSkeleton } from "@/app/(authenticated)/ranking/_components/RankingPageSkeletons";
import {
  RANKING_CARD_BG,
  RANKING_GREEN,
} from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";
import {
  emptyRankingBoardMeta,
  type RankingBoardMeta,
  type RankingBoardRow,
} from "@/lib/ranking/board-types";
import type { RankingHistoricoRow } from "@/lib/ranking/historico-types";
import {
  palpitesHrefForScope,
  type RankingScopeOption,
} from "@/lib/ranking/scopes-shared";
import { partidasUrlWithLiveSync } from "@/lib/football/live-sync-client";
import { parseRankingPalpitePushParams } from "@/lib/push/ranking-push-url";

type Step = "pick" | "board";

type ResumoStats = {
  palpites: number;
  acertos: number;
  pontos: number;
  exatos: number;
};

const CACHE_MS_DEFAULT = 45 * 1000;
const CACHE_MS_LIVE = 12 * 1000;

const boardCache = new Map<
  string,
  { at: number; payload: { rows: RankingBoardRow[]; meta: RankingBoardMeta } }
>();

export function RankingExperience() {
  const searchParams = useSearchParams();
  const { ticketId: highlightTicketId, matchId: highlightMatchId } =
    parseRankingPalpitePushParams(searchParams);

  const [step, setStep] = useState<Step>("pick");
  const [scopes, setScopes] = useState<RankingScopeOption[]>([]);
  const [selectedScope, setSelectedScope] = useState<RankingScopeOption | null>(
    null,
  );
  const [rankingRows, setRankingRows] = useState<RankingBoardRow[]>([]);
  const [meta, setMeta] = useState<RankingBoardMeta | null>(null);
  const [stats, setStats] = useState<ResumoStats>({
    palpites: 0,
    acertos: 0,
    pontos: 0,
    exatos: 0,
  });
  const [loadingScopes, setLoadingScopes] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchResults, setMatchResults] = useState<RankingHistoricoRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [stepsModalOpen, setStepsModalOpen] = useState(false);
  const [stepsModalScope, setStepsModalScope] =
    useState<RankingScopeOption | null>(null);

  const openStepsModal = useCallback((scope: RankingScopeOption) => {
    setStepsModalScope(scope);
    setStepsModalOpen(true);
  }, []);

  const livePollMs = meta?.hasLiveMatchesInPool ? 15_000 : 30_000;

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), livePollMs);
    return () => window.clearInterval(id);
  }, [livePollMs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingScopes(true);
      setError(null);
      try {
        const q = highlightTicketId
          ? `?default=${encodeURIComponent(highlightTicketId)}`
          : "";
        const r = await fetch(`/api/ranking/bootstrap${q}`, {
          credentials: "include",
          cache: "no-store",
        });
        const d = (await r.json()) as {
          scopes?: RankingScopeOption[];
          error?: string;
        };
        if (cancelled) return;
        setScopes(Array.isArray(d.scopes) ? d.scopes : []);
      } catch {
        if (!cancelled) setScopes([]);
      } finally {
        if (!cancelled) setLoadingScopes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [highlightTicketId]);

  const buildResumoQuery = (scope: RankingScopeOption) => {
    const resumoQ = new URLSearchParams();
    if (scope.mode === "principal") resumoQ.set("bolaoType", "principal");
    if (scope.mode === "diario" && scope.ticketId) {
      resumoQ.set("bolaoType", "diario");
      resumoQ.set("ticketId", scope.ticketId);
    }
    if (scope.mode === "extra" && scope.ticketId) {
      resumoQ.set("bolaoType", "extra");
      resumoQ.set("ticketId", scope.ticketId);
    }
    return resumoQ;
  };

  const boardUrlForScope = (scope: RankingScopeOption) =>
    scope.mode === "principal"
      ? "/api/ranking/board?mode=principal"
      : scope.mode === "extra"
        ? `/api/ranking/board?mode=extra&ticketId=${encodeURIComponent(scope.ticketId ?? "")}`
        : `/api/ranking/board?mode=diario&ticketId=${encodeURIComponent(scope.ticketId ?? "")}`;

  const loadBoard = useCallback(async (scope: RankingScopeOption) => {
    const cacheKey = scope.key;

    setLoadingBoard(true);
    setLoadingMatches(true);
    setRankingRows([]);
    setMeta(null);
    setMatchResults([]);
    setError(null);
    setStats({ palpites: 0, acertos: 0, pontos: 0, exatos: 0 });

    const historicoQ = buildResumoQuery(scope);
    historicoQ.set("limit", "50");

    const loadHistorico = async (): Promise<RankingHistoricoRow[]> => {
      const histResp = await fetch(
        `/api/palpites/historico?${historicoQ.toString()}`,
        { credentials: "include", cache: "no-store" },
      );
      const histData = (await histResp.json().catch(() => ({}))) as {
        historico?: RankingHistoricoRow[];
      };
      if (!histResp.ok || !Array.isArray(histData.historico)) return [];
      return [...histData.historico].sort((a, b) => {
        const da = a.jogoData?.split("/").reverse().join("") ?? "";
        const db = b.jogoData?.split("/").reverse().join("") ?? "";
        if (da !== db) return da.localeCompare(db);
        return (a.jogoHora ?? "").localeCompare(b.jogoHora ?? "");
      });
    };

    const boardUrl = boardUrlForScope(scope);

    try {
      const resumoResp = await fetch(
        `/api/palpites/resumo?${buildResumoQuery(scope).toString()}`,
        { credentials: "include", cache: "no-store" },
      );
      const resumoData = (await resumoResp.json().catch(() => ({}))) as {
        resumo?: ResumoStats;
      };
      const resumo: ResumoStats = resumoResp.ok && resumoData.resumo
        ? resumoData.resumo
        : { palpites: 0, acertos: 0, pontos: 0, exatos: 0 };
      setStats(resumo);

      const cached = boardCache.get(cacheKey);
      const historicoPromise =
        resumo.palpites >= 1 ? loadHistorico() : Promise.resolve([]);

      const cacheMs =
        cached?.payload.meta?.hasLiveMatchesInPool === true
          ? CACHE_MS_LIVE
          : CACHE_MS_DEFAULT;

      if (cached && Date.now() - cached.at < cacheMs) {
        setRankingRows(cached.payload.rows);
        setMeta(cached.payload.meta);
        setMatchResults(await historicoPromise);
        return;
      }

      const [boardResp, historico] = await Promise.all([
        fetch(boardUrl, { credentials: "include", cache: "no-store" }),
        historicoPromise,
      ]);

      setMatchResults(historico);

      const boardData = (await boardResp.json().catch(() => ({}))) as {
        rows?: RankingBoardRow[];
        meta?: RankingBoardMeta;
        error?: string;
      };

      if (!boardResp.ok) {
        setError(
          typeof boardData.error === "string"
            ? boardData.error
            : "Não foi possível carregar o ranking.",
        );
        setRankingRows([]);
        setMeta(null);
        return;
      }

      const rows = Array.isArray(boardData.rows) ? boardData.rows : [];
      const m = boardData.meta ?? emptyRankingBoardMeta();
      setRankingRows(rows);
      setMeta(m);
      boardCache.set(cacheKey, { at: Date.now(), payload: { rows, meta: m } });
    } catch {
      setError("Erro de rede ao carregar o ranking.");
      setRankingRows([]);
      setMeta(null);
      setMatchResults([]);
    } finally {
      setLoadingBoard(false);
      setLoadingMatches(false);
    }
  }, []);

  const refreshBoardLive = useCallback(
    async (scope: RankingScopeOption) => {
      const boardUrl = boardUrlForScope(scope);
      try {
        await fetch(partidasUrlWithLiveSync("/api/partidas", { allSynced: 1 }), {
          cache: "no-store",
        }).catch(() => undefined);

        const [boardResp, resumoResp] = await Promise.all([
          fetch(boardUrl, { credentials: "include", cache: "no-store" }),
          fetch(`/api/palpites/resumo?${buildResumoQuery(scope).toString()}`, {
            credentials: "include",
            cache: "no-store",
          }),
        ]);

        const boardData = (await boardResp.json().catch(() => ({}))) as {
          rows?: RankingBoardRow[];
          meta?: RankingBoardMeta;
        };
        if (boardResp.ok && Array.isArray(boardData.rows)) {
          const rows = boardData.rows;
          const m = boardData.meta ?? emptyRankingBoardMeta();
          setRankingRows(rows);
          setMeta(m);
          boardCache.set(scope.key, { at: Date.now(), payload: { rows, meta: m } });
        }

        const resumoData = (await resumoResp.json().catch(() => ({}))) as {
          resumo?: ResumoStats;
        };
        if (resumoResp.ok && resumoData.resumo) {
          setStats(resumoData.resumo);
        }
      } catch {
        /* mantém último estado válido */
      }
    },
    [],
  );

  const fetchMatchHistorico = useCallback(
    async (scope: RankingScopeOption): Promise<RankingHistoricoRow[]> => {
      const historicoQ = buildResumoQuery(scope);
      historicoQ.set("limit", "50");
      const histResp = await fetch(
        `/api/palpites/historico?${historicoQ.toString()}`,
        { credentials: "include", cache: "no-store" },
      );
      const histData = (await histResp.json().catch(() => ({}))) as {
        historico?: RankingHistoricoRow[];
      };
      if (!histResp.ok || !Array.isArray(histData.historico)) return [];
      return [...histData.historico].sort((a, b) => {
        const da = a.jogoData?.split("/").reverse().join("") ?? "";
        const db = b.jogoData?.split("/").reverse().join("") ?? "";
        if (da !== db) return da.localeCompare(db);
        return (a.jogoHora ?? "").localeCompare(b.jogoHora ?? "");
      });
    },
    [],
  );

  useEffect(() => {
    if (step !== "board" || !selectedScope || loadingBoard) return;
    if (stats.palpites < 1) return;
    let cancelled = false;
    void fetchMatchHistorico(selectedScope).then((rows) => {
      if (!cancelled) setMatchResults(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [step, selectedScope, loadingBoard, stats.palpites, tick, fetchMatchHistorico]);

  useEffect(() => {
    if (step !== "board" || !selectedScope || tick === 0 || loadingBoard) return;
    void refreshBoardLive(selectedScope);
  }, [step, selectedScope, tick, loadingBoard, refreshBoardLive]);

  const handleSelectScope = useCallback(
    (scope: RankingScopeOption) => {
      setSelectedScope(scope);
      setStep("board");
      void loadBoard(scope);
    },
    [loadBoard],
  );

  useEffect(() => {
    if (loadingScopes || step !== "pick" || !highlightTicketId) return;
    const scope = scopes.find((s) => s.ticketId === highlightTicketId);
    if (scope) handleSelectScope(scope);
  }, [loadingScopes, highlightTicketId, scopes, step, handleSelectScope]);

  const handleBackFromBoard = useCallback(() => {
    setStep("pick");
    setSelectedScope(null);
    setError(null);
  }, []);

  const topThree = useMemo(() => rankingRows.slice(0, 3), [rankingRows]);
  /** Tabela: apenas 4º ao 10º (pódio = top 3). */
  const rowsAfterPodium = useMemo(() => rankingRows.slice(3, 10), [rankingRows]);
  const padTopThree = useMemo(
    () =>
      [topThree[0] ?? null, topThree[1] ?? null, topThree[2] ?? null] as const,
    [topThree],
  );
  const myRows = useMemo(
    () => rankingRows.filter((r) => r.isMe && !r.isFiller),
    [rankingRows],
  );
  /** Cotas do usuário fora do top 10 — listadas abaixo da tabela. */
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
    if (loadingBoard || rankingRows.length === 0) return false;
    const everyoneZero = rankingRows.every(
      (r) => r.totalPoints === 0 && r.outcomeCount === 0,
    );
    if (!everyoneZero) return false;
    return meta?.hasResultedMatchesInPool !== true;
  }, [loadingBoard, rankingRows, meta?.hasResultedMatchesInPool]);

  const provisionalRankingNote =
    awaitingRankingScores && rankingRows.length > 0 ? (
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

  if (loadingScopes) {
    return (
      <main className="font-helvetica-now-display bg-black pb-28 text-white">
        <div className="mx-auto w-full px-4 pt-6 lg:max-w-4xl lg:px-6">
          <RankingFullPageSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className="font-helvetica-now-display bg-black pb-28 text-white">
      <div className="mx-auto w-full px-4 lg:max-w-4xl lg:px-6">
        {step === "pick" ? (
          <>
            <RankingPageHeader
              eyebrow="Classificação"
              title="Selecione seu"
              titleAccent="bolão"
              description={
                scopes.length > 0
                  ? `Escolha abaixo onde deseja ver a classificação, ${scopes.length} ${
                      scopes.length === 1 ? "bolão disponível" : "bolões disponíveis"
                    }.`
                  : "Escolha abaixo onde deseja ver a classificação."
              }
            />

            {scopes.length === 0 ? (
              <section
                className="mt-8 rounded-[16px] px-5 py-10 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
                style={{ background: RANKING_CARD_BG }}
              >
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                  <Ticket className="size-7 text-primary" strokeWidth={2} />
                </div>
                <h2 className="mt-4 text-[15px] font-black uppercase tracking-wide text-white">
                  Nenhuma cota ativa
                </h2>
                <p className="mx-auto mt-2 max-w-[280px] text-[13px] font-medium leading-relaxed text-white/48">
                  Adquira uma cota para acompanhar sua posição e disputar os
                  prêmios do ranking.
                </p>
                <div className="mx-auto mt-6 flex w-full max-w-xs flex-col gap-2">
                  <Link
                    href="/boloes"
                    className="inline-flex h-11 items-center justify-center rounded-xl text-[11px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
                    style={{ background: RANKING_GREEN }}
                  >
                    Ver bolões e cotas
                  </Link>
                  <Link
                    href="/tickets"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-white/14 text-[11px] font-black uppercase tracking-wide text-white/85"
                  >
                    Minhas compras
                  </Link>
                </div>
              </section>
            ) : (
              <RankingScopePicker
                scopes={scopes}
                highlightTicketId={highlightTicketId}
                onOpenRanking={handleSelectScope}
                onOpenSteps={openStepsModal}
              />
            )}
          </>
        ) : selectedScope ? (
          <RankingBoardStep
            scope={selectedScope}
            loading={loadingBoard}
            loadingMatches={loadingMatches}
            error={error}
            rows={rankingRows}
            matchResults={matchResults}
            stats={stats}
            provisionalNote={provisionalRankingNote}
            padTopThree={padTopThree}
            rowsAfterPodium={rowsAfterPodium}
            allRows={rankingRows}
            myRowsFooter={myRowsFooter}
            onBack={handleBackFromBoard}
            refreshClockMs={tick}
            highlightMatchId={highlightMatchId}
          />
        ) : null}

        {stepsModalScope ? (
          <RankingPalpitesStepsModal
            open={stepsModalOpen}
            onOpenChange={(open) => {
              setStepsModalOpen(open);
              if (!open) setStepsModalScope(null);
            }}
            palpitesHref={palpitesHrefForScope(stepsModalScope)}
          />
        ) : null}
      </div>
    </main>
  );
}
