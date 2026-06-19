"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getAvatarPresetImage } from "@/lib/user/avatar-presets";
import { clampAvatarIndex } from "@/lib/auth/avatar-index";
import type { RankingBoardRow } from "@/lib/ranking/board-types";

const GREEN = "#B1EB0B";
const CARD_BG = "#111111";

const RANK_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

function RankBadge({ pos }: { pos: number }) {
  const color = RANK_COLORS[pos];
  if (color) {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-black"
        style={{ background: color }}
      >
        {pos}
      </span>
    );
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white/70">
      {pos}
    </span>
  );
}

function PlayerRow({ row }: { row: RankingBoardRow }) {
  const preset = getAvatarPresetImage(clampAvatarIndex(row.avatarIndex));
  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/5 last:border-b-0">
      <RankBadge pos={row.pos} />
      <div className="relative size-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
        {row.avatarUploadFilename ? (
          <Image
            src={`/api/public/avatar/${encodeURIComponent(row.userId)}?v=${encodeURIComponent(row.avatarUploadFilename)}`}
            alt=""
            fill
            className="object-cover"
            sizes="28px"
            unoptimized
          />
        ) : (
          <Image src={preset} alt="" fill className="object-cover" sizes="28px" />
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white">
        @{row.displayName.toLowerCase().replace(/\s+/g, "")}
      </span>
      <span className="shrink-0 text-[12px] font-black tabular-nums" style={{ color: GREEN }}>
        {row.totalPoints.toLocaleString("pt-BR")} pts
      </span>
    </div>
  );
}

export function HomeRankingTop5({ className = "" }: { className?: string }) {
  const [rows, setRows] = useState<RankingBoardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ranking/board?mode=principal", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data: { rows?: RankingBoardRow[] }) => {
        if (!cancelled && Array.isArray(data.rows)) {
          setRows(data.rows.filter((r) => !r.isFiller).slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className={className} aria-labelledby="ranking-top5-heading">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3
          id="ranking-top5-heading"
          className="text-[15px] font-black uppercase tracking-[0.04em] text-white"
        >
          TOP 5 DO RANKING
        </h3>
        <Link
          href="/ranking"
          className="shrink-0 text-[11px] font-black uppercase tracking-wide transition-opacity hover:opacity-90"
          style={{ color: GREEN }}
        >
          VER RANKING COMPLETO &gt;
        </Link>
      </div>

      <div
        className="overflow-hidden rounded-[14px] border border-white/8 px-3"
        style={{ background: CARD_BG }}
      >
        {loading ? (
          <div className="flex h-[160px] items-center justify-center">
            <div className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-[#B1EB0B]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-5 text-center text-[12px] text-white/40">Sem dados</p>
        ) : (
          rows.map((row) => <PlayerRow key={row.ticketId} row={row} />)
        )}
      </div>
    </section>
  );
}
