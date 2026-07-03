"use client";

import { useEffect, useState } from "react";
import type { BolaoDefinitionCatalogItem } from "@/lib/boloes/definitions/types";
import { UpcomingBolaoCard } from "@/app/components/UpcomingBolaoCard";

const GREEN = "#B1EB0B";
const CATALOG_POLL_MS = 30_000;

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
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((item) => (
          <UpcomingBolaoCard key={item.id} item={item} />
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
