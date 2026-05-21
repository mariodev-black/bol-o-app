"use client";

import type { ReactNode } from "react";
import { RankingBoardHeader } from "@/app/(authenticated)/ranking/_components/RankingBoardHeader";
import { RankingBoardMatchResults } from "@/app/(authenticated)/ranking/_components/RankingBoardMatchResults";
import { RankingBoardPanel } from "@/app/(authenticated)/ranking/_components/RankingBoardPanel";
import { RANKING_BORDER, RANKING_CARD_BG } from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";
import type { RankingBoardRow } from "@/lib/ranking/board-types";
import type { RankingHistoricoRow } from "@/lib/ranking/historico-types";
import type { RankingScopeOption } from "@/lib/ranking/scopes-shared";

const BOARD_CARD = "#101010";

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
      style={{ background: BOARD_CARD, borderColor: RANKING_BORDER }}
      aria-label="Seu desempenho neste bolão"
    >
      {items.map((item, idx) => (
        <div
          key={item.label}
          className={`py-4 text-center ${idx < 2 ? "border-r border-white/8" : ""}`}
        >
          <p className="text-[12px] font-black uppercase tracking-wide text-white/75 min-[380px]:text-[13px]">
            {item.label}
          </p>
          <p className="mt-2 text-[24px] font-black tabular-nums text-primary min-[380px]:text-[26px]">
            {item.value}
          </p>
        </div>
      ))}
    </section>
  );
}

export function RankingBoardStep({
  scope,
  previewLabel,
  loading,
  error,
  rows,
  matchResults,
  loadingMatches,
  stats,
  provisionalNote,
  padTopThree,
  rowsFourToTen,
  myRowsFooter,
  onBack,
  refreshClockMs,
}: {
  scope: RankingScopeOption;
  previewLabel?: string;
  loading: boolean;
  error: string | null;
  rows: RankingBoardRow[];
  matchResults: RankingHistoricoRow[];
  loadingMatches: boolean;
  stats: ResumoStats;
  provisionalNote: ReactNode;
  padTopThree: readonly [
    RankingBoardRow | null,
    RankingBoardRow | null,
    RankingBoardRow | null,
  ];
  rowsFourToTen: RankingBoardRow[];
  myRowsFooter: RankingBoardRow[];
  onBack: () => void;
  refreshClockMs?: number;
}) {
  return (
    <div className="pt-6">
      <RankingBoardHeader
        scope={scope}
        onBack={onBack}
        previewLabel={previewLabel}
      />

      {error ? (
        <p className="mt-4 text-center text-[14px] font-semibold text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div
          className="mt-5 animate-pulse rounded-2xl border border-white/10 py-24"
          style={{ background: RANKING_CARD_BG }}
          aria-hidden
        />
      ) : (
        <div className="mt-5 space-y-5">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-[16px] font-medium text-white/80">
              Ainda não há participantes neste bolão.
            </p>
          ) : (
            <RankingBoardPanel
              provisional={
                provisionalNote ? <div className="mb-3">{provisionalNote}</div> : null
              }
              padTopThree={padTopThree}
              rowsFourToTen={rowsFourToTen}
              myRowsFooter={myRowsFooter}
            />
          )}

          <RankingBoardMatchResults
            matches={matchResults}
            loading={loadingMatches}
            refreshClockMs={refreshClockMs}
          />

          <MyStatsFooter stats={stats} />
        </div>
      )}
    </div>
  );
}
