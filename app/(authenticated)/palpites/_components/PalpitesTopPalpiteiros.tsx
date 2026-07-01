"use client";

import Image from "next/image";
import Link from "next/link";
import {
  TrophyBronze,
  TrophyGold,
  TrophySilver,
} from "@/app/components/RankingTrophies";
import { getAvatarPresetImage } from "@/lib/user/avatar-presets";
import type { RankingBoardRow } from "@/lib/ranking/board-types";
import { rankingDefaultScopeKey } from "@/lib/ranking/scopes-shared";

function RankingMedal({ pos, size = 24 }: { pos: number; size?: number }) {
  if (pos === 1) return <TrophyGold size={size} />;
  if (pos === 2) return <TrophySilver size={size} />;
  if (pos === 3) return <TrophyBronze size={size} />;
  return (
    <span className="text-[11px] font-bold text-white/25">#{pos}</span>
  );
}

function MiniAvatar({
  row,
  sizeClass,
}: {
  row: RankingBoardRow;
  sizeClass: string;
}) {
  const ring = row.isMe ? "ring-2 ring-primary/45" : "ring-1 ring-white/12";

  if (row.avatarUploadFilename) {
    const src = `/api/public/avatar/${encodeURIComponent(row.userId)}?v=${encodeURIComponent(row.avatarUploadFilename)}`;
    return (
      <div
        className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full ${ring}`}
      >
        <Image src={src} alt="" fill className="object-cover" sizes="64px" unoptimized />
      </div>
    );
  }

  const preset = getAvatarPresetImage(row.avatarIndex);
  return (
    <div
      className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-full ${ring}`}
    >
      <Image src={preset} alt="" fill className="object-cover" sizes="64px" />
    </div>
  );
}

export function PalpitesTopPalpiteiros({
  rows,
  loading,
  ticketId,
  bolaoDefinitionId,
  compact,
  onRankingLinkClick,
}: {
  rows: RankingBoardRow[];
  loading?: boolean;
  ticketId: string | null;
  bolaoDefinitionId?: string | null;
  compact?: boolean;
  onRankingLinkClick?: () => void;
}) {
  const top = rows.slice(0, compact ? 3 : 5);
  const rankingDefault = rankingDefaultScopeKey(ticketId, bolaoDefinitionId);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        background: "#101010",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-[13px] font-bold text-white">Top Palpiteiros</span>
        {rankingDefault ? (
          onRankingLinkClick ? (
            <button
              type="button"
              onClick={onRankingLinkClick}
              className="text-[12px] font-semibold text-primary hover:text-primary/85"
            >
              Ver todos
            </button>
          ) : (
            <Link
              href={`/ranking?default=${encodeURIComponent(rankingDefault)}`}
              className="text-[12px] font-semibold text-primary hover:text-primary/85"
            >
              Ver todos
            </Link>
          )
        ) : null}
      </div>

      {loading ? (
        <div className="animate-pulse px-4 py-8" aria-hidden>
          <div className="mb-3 h-10 rounded-lg bg-white/6" />
          <div className="mb-3 h-10 rounded-lg bg-white/6" />
          <div className="h-10 rounded-lg bg-white/6" />
        </div>
      ) : top.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] font-medium text-white/45">
          Ranking indisponível
        </p>
      ) : (
        top.map((r, i) => (
          <div
            key={r.ticketId}
            className="flex items-center gap-2.5 px-3 py-2.5"
            style={{
              background: r.isMe ? "rgba(177,235,11,0.07)" : "transparent",
              borderBottom:
                i < top.length - 1
                  ? "1px solid rgba(255,255,255,0.04)"
                  : "none",
            }}
          >
            <div className="flex size-6 shrink-0 items-center justify-center">
              <RankingMedal pos={r.pos} size={24} />
            </div>
            <MiniAvatar row={r} sizeClass="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">
                {r.displayName}
                {r.isMe ? (
                  <span className="ml-0.5 text-[11px] font-normal text-white/35">
                    (você)
                  </span>
                ) : null}
              </p>
              <p className="text-[11px] text-white/35">
                {r.outcomeCount} acertos
              </p>
            </div>
            <div className="flex shrink-0 items-baseline gap-0.5">
              <span
                className={`text-[14px] font-black ${r.isMe ? "text-primary" : "text-white"}`}
              >
                {r.totalPoints}
              </span>
              <span className="text-[9px] text-white/25">pts</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
