"use client";

import Image from "next/image";
import Link from "next/link";
import { Users } from "lucide-react";
import { formatParticipantsShort } from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";
import type { OutrosBolaoGridItem } from "@/lib/boloes-outros-grid";
import iconBrasileirao2 from "@/app/assets/icon-brasileirao2.png";
import iconCopaMundo2026 from "@/app/assets/icon-copa-mundo2.png";
import iconPremiere2 from "@/app/assets/icon-premiere2.png";
import {
  getBrasileiraoChampionshipId,
  getPremierChampionshipId,
} from "@/lib/boloes-outros-grid";
import { getCopaChampionshipId } from "@/lib/boloes-extra-config";
import type { StaticImageData } from "next/image";

const GREEN = "#B1EB0B";
const CARD_BG = "#111111";
const MUTED = "#FFFFFFAD";

const LOGO_BY_CHAMPIONSHIP_ID: Record<number, StaticImageData> = {
  [getCopaChampionshipId()]: iconCopaMundo2026,
  [getBrasileiraoChampionshipId()]: iconBrasileirao2,
  [getPremierChampionshipId()]: iconPremiere2,
};

const LOGO_BY_LABEL: Record<string, StaticImageData> = {
  "COPA DO MUNDO": iconCopaMundo2026,
  "BRASILEIRÃO": iconBrasileirao2,
  "PREMIER LEAGUE": iconPremiere2,
};

function logoForItem(item: OutrosBolaoGridItem): StaticImageData {
  return (
    LOGO_BY_CHAMPIONSHIP_ID[item.championshipId] ??
    LOGO_BY_LABEL[item.label] ??
    iconBrasileirao2
  );
}

function OutrosBolaoCard({ item }: { item: OutrosBolaoGridItem }) {
  const href = `/tickets?bolao=extra&championshipId=${item.championshipId}`;
  const participantsLabel = `${formatParticipantsShort(item.participants)} mil`;

  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col items-center rounded-[14px] px-2 py-5 transition-[filter,transform] active:scale-[0.98] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      style={{ backgroundColor: CARD_BG }}
      aria-label={`${item.label}, ${participantsLabel} participantes`}
    >
      <div className="flex h-[56px] w-full items-center justify-center">
        <Image
          src={logoForItem(item)}
          alt=""
          width={140}
          height={56}
          className="h-[52px] w-auto max-w-[92%] object-contain"
          draggable={false}
        />
      </div>

      <p className="mt-2 w-full px-0.5 text-center text-[10px] font-black uppercase leading-tight tracking-[0.02em] text-white min-[360px]:text-[11px]">
        {item.label}
      </p>

      <div
        className="mt-2.5 flex items-center justify-center gap-2"
        style={{ color: MUTED }}
      >
        <Users className="size-5 shrink-0 opacity-90" strokeWidth={2.2} aria-hidden />
        <span className="text-[19px] font-semibold leading-none">{participantsLabel}</span>
      </div>
    </Link>
  );
}

export function OutrosBoloesGrid({
  items,
  className = "mt-5",
}: {
  items: OutrosBolaoGridItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className={className} aria-labelledby="outros-boloes-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3
          id="outros-boloes-heading"
          className="text-[15px] font-black uppercase tracking-[0.04em] text-white"
        >
          OUTROS BOLÕES
        </h3>
        <Link
          href="/tickets?bolao=extra"
          className="shrink-0 text-[13px] font-black uppercase tracking-wide transition-opacity hover:opacity-90"
          style={{ color: GREEN }}
        >
          VER TODOS &gt;
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <OutrosBolaoCard key={item.championshipId} item={item} />
        ))}
      </div>
    </section>
  );
}
