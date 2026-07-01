"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Clock, Radio, Trophy, Users } from "lucide-react";
import type { BolaoDefinitionCatalogItem } from "@/lib/boloes/definitions/types";
import { LIFECYCLE_STATUS_LABELS } from "@/lib/boloes/definitions/lifecycle-labels";
import {
  extraBolaoIconSrc,
  type ExtraBolaoIconVariant,
} from "@/app/shared/extra-bolao-icons";
import { formatParticipantsShort } from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";

const GREEN = "#B1EB0B";
const CATALOG_POLL_MS = 30_000;

function formatCountdown(ms: number | null): string | null {
  if (ms == null || ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((totalSec % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function LifecycleBadge({ status }: { status: BolaoDefinitionCatalogItem["lifecycleStatus"] }) {
  if (status === "ao_vivo") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-[6px] bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300">
        <Radio className="size-2.5 animate-pulse" aria-hidden />
        Ao vivo
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-[6px] bg-white/6 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55">
      {LIFECYCLE_STATUS_LABELS[status]}
    </span>
  );
}

function CatalogCard({ item }: { item: BolaoDefinitionCatalogItem }) {
  const href = `/tickets?definitionId=${encodeURIComponent(item.id)}`;
  const countdown = formatCountdown(item.countdownToStartMs ?? item.countdownToEndMs);
  const logoSrc =
    item.resolvedLogoUrl ??
    extraBolaoIconSrc(
      (item.resolvedIconVariant || "generic") as ExtraBolaoIconVariant,
    ).src;

  return (
    <Link
      href={href}
      className="group flex gap-3 rounded-[16px] border border-white/6 bg-[#111111] p-4 transition hover:border-white/12"
    >
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-white/8 bg-[#0a0a0a]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" className="max-h-full max-w-full object-contain p-1.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[15px] font-black uppercase leading-tight text-white">
              {item.displayName}
            </p>
            {item.subtitle ? (
              <p className="mt-0.5 text-[12px] text-white/45">{item.subtitle}</p>
            ) : null}
          </div>
          <LifecycleBadge status={item.lifecycleStatus} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
          {item.participantCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {formatParticipantsShort(item.participantCount)}
            </span>
          ) : null}
          {item.estimatedPrizeLabel ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <Trophy className="size-3" />
              {item.estimatedPrizeLabel}
            </span>
          ) : (
            <span>{item.priceLabel}</span>
          )}
          {countdown ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {item.lifecycleStatus === "programado" ? "Começa em " : ""}
              {countdown}
            </span>
          ) : null}
          {item.datesLabel ? <span>{item.datesLabel}</span> : null}
        </div>
      </div>
      <ChevronRight
        className="mt-2 size-4 shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden
      />
    </Link>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: BolaoDefinitionCatalogItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: GREEN }}>
        {title}
      </h2>
      <div className="space-y-2.5">
        {items.map((item) => (
          <CatalogCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export type DynamicBolaoCatalogProps = {
  upcoming: BolaoDefinitionCatalogItem[];
  available: BolaoDefinitionCatalogItem[];
  closed: BolaoDefinitionCatalogItem[];
};

export function DynamicBolaoCatalogSections({
  upcoming: initialUpcoming,
  available: initialAvailable,
  closed: initialClosed,
}: DynamicBolaoCatalogProps) {
  const [sections, setSections] = useState({
    upcoming: initialUpcoming,
    available: initialAvailable,
    closed: initialClosed,
  });

  useEffect(() => {
    setSections({
      upcoming: initialUpcoming,
      available: initialAvailable,
      closed: initialClosed,
    });
  }, [initialUpcoming, initialAvailable, initialClosed]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const r = await fetch("/api/boloes/catalog", { cache: "no-store" });
        const d = (await r.json()) as DynamicBolaoCatalogProps;
        if (cancelled || !r.ok) return;
        setSections({
          upcoming: d.upcoming ?? [],
          available: d.available ?? [],
          closed: d.closed ?? [],
        });
      } catch {
        /* mantém último snapshot */
      }
    };
    const id = window.setInterval(() => void refresh(), CATALOG_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const { upcoming, available, closed } = sections;
  const hasAny = upcoming.length + available.length + closed.length > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-6">
      <Section title="Próximos bolões" items={upcoming} />
      <Section title="Bolões disponíveis" items={available} />
      <Section title="Bolões encerrados" items={closed} />
    </div>
  );
}
