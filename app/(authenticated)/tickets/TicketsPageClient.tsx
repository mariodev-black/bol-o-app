"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppScreenLoading } from "@/app/shared/AppScreenLoading";
import { TicketCheckoutFlow } from "./_components/TicketCheckoutFlow";

function TicketsPageContent({
  serverExtraChampionshipIds,
  ticketsExtraOnly,
}: {
  serverExtraChampionshipIds: number[];
  ticketsExtraOnly: boolean;
}) {
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
    <div className="flex min-h-screen min-h-0 flex-1 flex-col bg-black">
      <TicketCheckoutFlow
        key={`${bolao}-${initialExtraChampionshipId ?? ""}-${ticketsExtraOnly ? "xo" : "all"}`}
        initialTicketKind={initialTicketKind}
        initialExtraChampionshipId={initialExtraChampionshipId}
        serverExtraChampionshipIds={serverExtraChampionshipIds}
        ticketsExtraOnly={ticketsExtraOnly}
      />
    </div>
  );
}

export function TicketsPageClient({
  serverExtraChampionshipIds,
  ticketsExtraOnly,
}: {
  serverExtraChampionshipIds: number[];
  ticketsExtraOnly: boolean;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full flex-col bg-black">
          <AppScreenLoading variant="app-shell" message="Carregando..." className="flex-1" />
        </div>
      }
    >
      <TicketsPageContent
        serverExtraChampionshipIds={serverExtraChampionshipIds}
        ticketsExtraOnly={ticketsExtraOnly}
      />
    </Suspense>
  );
}
