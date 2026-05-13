"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TicketCheckoutFlow } from "./_components/TicketCheckoutFlow";

function TicketsPageContent({ serverExtraChampionshipIds }: { serverExtraChampionshipIds: number[] }) {
  const search = useSearchParams();
  const bolaoRaw = search.get("bolao");
  const bolao =
    bolaoRaw === "diario" ? "diario" : bolaoRaw === "extra" ? "extra" : "principal";
  const championshipParam = search.get("championshipId");
  const parsedChamp = championshipParam ? Number.parseInt(championshipParam, 10) : NaN;
  const initialExtraChampionshipId =
    bolao === "extra" && Number.isFinite(parsedChamp) && parsedChamp > 0 ? parsedChamp : undefined;

  const initialTicketKind =
    bolao === "diario" ? "daily" : bolao === "extra" && initialExtraChampionshipId != null ? "extra" : "general";

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <TicketCheckoutFlow
        key={`${bolao}-${initialExtraChampionshipId ?? ""}`}
        initialTicketKind={initialTicketKind}
        initialExtraChampionshipId={initialExtraChampionshipId}
        serverExtraChampionshipIds={serverExtraChampionshipIds}
      />
    </div>
  );
}

export function TicketsPageClient({ serverExtraChampionshipIds }: { serverExtraChampionshipIds: number[] }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <TicketsPageContent serverExtraChampionshipIds={serverExtraChampionshipIds} />
    </Suspense>
  );
}
