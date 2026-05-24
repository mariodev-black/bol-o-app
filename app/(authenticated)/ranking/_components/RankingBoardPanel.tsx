"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import {
  TrophyBronze,
  TrophyGold,
  TrophySilver,
} from "@/app/components/RankingTrophies";
import { getAvatarPresetImage } from "@/lib/user/avatar-presets";
import type { RankingBoardRow } from "@/lib/ranking/board-types";
import {
  isRankingFillerRow,
  rankingFillerAvatarUserId,
} from "@/lib/ranking/ranking-bots";

const PRIMARY = "#B1EB0B";
const CARD = "#101010";
const MY_COTA_CARD = "#161616";
const BORDER = "rgba(255,255,255,0.08)";

function rankingTicketShortLabel(ticketId: string): string {
  const hex = String(ticketId).replace(/-/g, "");
  return hex.slice(0, 6).toUpperCase();
}

function rankingRowsForTop10Gap(allRows: RankingBoardRow[]): RankingBoardRow[] {
  return allRows.filter((r) => !isRankingFillerRow(r));
}

function pointsGapToTop10(
  row: RankingBoardRow,
  allRows: RankingBoardRow[],
): { gap: number; inTop10: boolean; tieAtTenth: boolean } {
  const realRows = rankingRowsForTop10Gap(allRows);
  if (row.pos <= 10 && !isRankingFillerRow(row)) {
    return { gap: 0, inTop10: true, tieAtTenth: false };
  }
  if (realRows.length < 10) {
    return { gap: 0, inTop10: true, tieAtTenth: false };
  }
  const tenth = realRows[9];
  if (!tenth) {
    return { gap: 0, inTop10: false, tieAtTenth: false };
  }
  const gap = Math.max(0, tenth.totalPoints - row.totalPoints);
  return {
    gap,
    inTop10: false,
    tieAtTenth: gap === 0 && row.pos > 10,
  };
}

function PlayerAvatar({
  userId,
  isMe,
  avatarIndex,
  avatarUploadFilename,
  sizeClass,
}: {
  userId: string;
  isMe?: boolean;
  avatarIndex: number;
  avatarUploadFilename: string | null;
  sizeClass: string;
}) {
  const ring = isMe ? "ring-2 ring-primary/50" : "ring-1 ring-white/15";

  const avatarUserId = rankingFillerAvatarUserId(userId);

  if (avatarUploadFilename) {
    const src = `/api/public/avatar/${encodeURIComponent(avatarUserId)}?v=${encodeURIComponent(avatarUploadFilename)}`;
    return (
      <div
        className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full ${ring}`}
      >
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes="96px"
          unoptimized
        />
      </div>
    );
  }

  const preset = getAvatarPresetImage(avatarIndex);
  return (
    <div
      className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full ${ring}`}
    >
      <Image src={preset} alt="" fill className="object-cover" sizes="96px" />
    </div>
  );
}

function PodiumMedal({ rank }: { rank: 1 | 2 | 3 }) {
  if (rank === 1) return <TrophyGold size={32} label="1" />;
  if (rank === 2) return <TrophySilver size={28} />;
  return <TrophyBronze size={28} />;
}

function PodiumCard({
  row,
  rank,
  elevated,
}: {
  row: RankingBoardRow;
  rank: 1 | 2 | 3;
  elevated: boolean;
}) {
  const filler = isRankingFillerRow(row);
  return (
    <div
      className={`flex min-w-0 flex-col items-stretch ${elevated ? "w-[34%] max-w-[132px] -translate-y-1" : "w-[30%] max-w-[118px]"}`}
    >
      <div
        className="flex flex-col items-center rounded-2xl px-1 pb-3 pt-2.5"
        style={{
          background: CARD,
          borderWidth: 2,
          borderStyle: "solid",
          borderColor: elevated ? "rgba(177,235,11,0.65)" : BORDER,
          boxShadow: elevated
            ? "0 0 28px rgba(177,235,11,0.28), inset 0 1px 0 rgba(255,255,255,0.06)"
            : "0 8px 24px rgba(0,0,0,0.45)",
        }}
      >
        <div className="mb-2 flex h-9 items-center justify-center">
          <PodiumMedal rank={rank} />
        </div>
        <PlayerAvatar
          userId={row.userId}
          isMe={Boolean(row.isMe)}
          avatarIndex={row.avatarIndex}
          avatarUploadFilename={row.avatarUploadFilename}
          sizeClass={elevated ? "size-[4.25rem]" : "size-14"}
        />
        <div className="mt-2 flex max-w-full items-center justify-center gap-0.5 px-0.5">
          <span className="truncate text-center text-[12px] font-black text-white min-[380px]:text-[13px]">
            {row.displayName}
          </span>
          {!filler ? (
            <Check
              className="size-3 shrink-0 text-primary"
              strokeWidth={3}
              aria-hidden
            />
          ) : null}
        </div>
        <p className="mt-2 text-[9px] font-black uppercase tracking-wide text-white/48">
          {row.outcomeCount} acertos
        </p>
        <p
          className="mt-0.5 text-center font-black leading-none text-primary"
          style={{ fontSize: elevated ? "1.35rem" : "1.1rem" }}
        >
          {row.totalPoints} pontos
        </p>
      </div>
    </div>
  );
}

function RankingDataRow({ row }: { row: RankingBoardRow }) {
  const isMe = Boolean(row.isMe);
  const filler = isRankingFillerRow(row);
  return (
    <div
      className="relative grid grid-cols-[40px_minmax(0,1fr)_64px_56px] items-center gap-1 border-b border-white/4 px-3 py-2.5 last:border-b-0"
      style={{
        background: isMe
          ? "linear-gradient(90deg, rgba(177,235,11,0.14), rgba(177,235,11,0.03))"
          : "transparent",
        boxShadow: isMe ? "inset 0 0 0 1px rgba(177,235,11,0.22)" : undefined,
      }}
    >
      {isMe ? (
        <span
          className="absolute left-2 top-1/2 z-1 -translate-y-1/2 rounded px-1 py-0.5 text-[7px] font-black uppercase text-[#0E141B]"
          style={{ background: PRIMARY }}
        >
          Você
        </span>
      ) : null}
      <span
        className={`text-[16px] font-black tabular-nums text-white/75 ${isMe ? "pl-10" : ""}`}
      >
        {row.pos}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <PlayerAvatar
          userId={row.userId}
          isMe={isMe}
          avatarIndex={row.avatarIndex}
          avatarUploadFilename={row.avatarUploadFilename}
          sizeClass="size-8"
        />
        <span className="truncate text-[12px] font-black text-white">
          {row.displayName}
        </span>
        {!filler ? (
          <Check
            className="size-3 shrink-0 text-primary"
            strokeWidth={3}
            aria-hidden
          />
        ) : null}
      </div>
      <span className="text-right text-[12px] font-bold tabular-nums text-white/78">
        {row.outcomeCount}
      </span>
      <span className="text-right text-[16px] font-black tabular-nums text-primary">
        {row.totalPoints}
      </span>
    </div>
  );
}

function RankingMyCotaFooterCard({
  row,
  allRows,
}: {
  row: RankingBoardRow;
  allRows: RankingBoardRow[];
}) {
  const { gap, tieAtTenth } = pointsGapToTop10(row, allRows);
  const tenth = allRows[9];
  const showGapNote = tieAtTenth || gap > 0;

  return (
    <article
      className="overflow-hidden rounded-2xl"
      style={{ background: MY_COTA_CARD }}
    >
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <PlayerAvatar
            userId={row.userId}
            isMe
            avatarIndex={row.avatarIndex}
            avatarUploadFilename={row.avatarUploadFilename}
            sizeClass="size-11"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
              Sua cota
            </p>
            <p className="mt-0.5 font-mono text-[12px] font-medium tracking-wide text-white/70">
              #{rankingTicketShortLabel(row.ticketId)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div
            className="rounded-xl border border-white/8 px-3 py-2.5"
            style={{ background: CARD }}
          >
            <p className="text-[11px] font-medium text-white/55">Posição</p>
            <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-white tabular-nums">
              {row.pos}
              <span className="ml-0.5 text-[15px] font-semibold text-white/70">
                º
              </span>
            </p>
            <p className="mt-1 text-[12px] font-medium text-white/45">lugar</p>
          </div>
          <div
            className="rounded-xl border border-white/8 px-3 py-2.5"
            style={{ background: CARD }}
          >
            <p className="text-[11px] font-medium text-white/55">Pontuação</p>
            <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-primary">
              {row.totalPoints}
            </p>
            <p className="mt-1 text-[12px] font-medium text-primary/65">
              pontos
            </p>
          </div>
        </div>

        {showGapNote ? (
          <div
            className="mt-3 rounded-xl border border-white/8 px-3.5 py-3"
            style={{ background: "#0e0e0e" }}
          >
            <p className="text-[16px] font-semibold uppercase tracking-widest text-white/80">
              Meta top 10
            </p>
            {tieAtTenth ? (
              <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-white/78">
                Você tem os mesmos{" "}
                <span className="font-semibold tabular-nums text-white">
                  {tenth?.totalPoints ?? "—"} pts
                </span>{" "}
              </p>
            ) : (
              <p className="mt-1.5 text-[16px] font-medium leading-relaxed text-white/78">
                Faltam{" "}
                <span className="text-[15px] font-bold tabular-nums text-primary">
                  {gap}
                </span>{" "}
                {gap === 1 ? "ponto" : "pontos"} para entrar no top 10
              </p>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function RankingBoardPanel({
  provisional,
  padTopThree,
  rowsAfterPodium,
  allRows,
  myRowsFooter,
  totalCount,
}: {
  provisional: ReactNode;
  padTopThree: readonly [
    RankingBoardRow | null,
    RankingBoardRow | null,
    RankingBoardRow | null,
  ];
  rowsAfterPodium: RankingBoardRow[];
  allRows: RankingBoardRow[];
  myRowsFooter: RankingBoardRow[];
  totalCount: number;
}) {
  return (
    <>
      {provisional}
      <section className="mt-5 flex items-end justify-center gap-2 px-0.5">
        {padTopThree[1] ? (
          <PodiumCard row={padTopThree[1]!} rank={2} elevated={false} />
        ) : (
          <div className="w-[30%]" />
        )}
        {padTopThree[0] ? (
          <PodiumCard row={padTopThree[0]!} rank={1} elevated />
        ) : (
          <div className="w-[34%]" />
        )}
        {padTopThree[2] ? (
          <PodiumCard row={padTopThree[2]!} rank={3} elevated={false} />
        ) : (
          <div className="w-[30%]" />
        )}
      </section>

      <section className="mt-6">
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: CARD, borderColor: BORDER }}
        >
          <div className="flex items-center justify-between border-b border-white/7 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/45 min-[380px]:text-[11px]">
              Top 10 — 4º ao 10º
            </p>
          </div>
          <div className="grid grid-cols-[40px_minmax(0,1fr)_64px_56px] gap-1 border-b border-white/7 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/45 min-[380px]:text-[11px]">
            <span>#</span>
            <span>Jogador</span>
            <span className="text-right">Acertos</span>
            <span className="text-right">Pontos</span>
          </div>
          {rowsAfterPodium.length > 0 ? (
            rowsAfterPodium.map((row) => (
              <RankingDataRow key={`${row.pos}-${row.ticketId}`} row={row} />
            ))
          ) : totalCount > 0 && totalCount <= 3 ? (
            <p className="px-3 py-4 text-center text-[12px] font-medium text-white/45">
              {totalCount === 1
                ? "1 participante no pódio acima."
                : `${totalCount} participantes no pódio acima.`}
            </p>
          ) : totalCount > 3 && totalCount <= 10 ? (
            <p className="px-3 py-4 text-center text-[12px] font-medium text-white/45">
              Todos os participantes estão no pódio acima.
            </p>
          ) : null}
        </div>
      </section>

      {myRowsFooter.length > 0 ? (
        <section className="mt-3 space-y-2">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
            {myRowsFooter.length > 1
              ? "Suas cotas fora do top 10"
              : "Sua posição no bolão"}
          </p>
          {myRowsFooter.map((row) => (
            <RankingMyCotaFooterCard
              key={row.ticketId}
              row={row}
              allRows={allRows}
            />
          ))}
        </section>
      ) : null}
    </>
  );
}
