"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppScreenLoading } from "@/app/shared/AppScreenLoading";
import { TicketCheckoutFlow } from "./_components/TicketCheckoutFlow";
import { LpTicketCheckoutFlow } from "./_components/LpTicketCheckoutFlow";

function TicketsPageContent({
  serverExtraChampionshipIds,
  ticketsExtraOnly,
  ticketsHideDaily,
  ticketsPrincipalOnly = false,
}: {
  serverExtraChampionshipIds: number[];
  ticketsExtraOnly: boolean;
  ticketsHideDaily: boolean;
  ticketsPrincipalOnly?: boolean;
}) {
  const search = useSearchParams();
  const lpFlow =
    search.get("lp") === "1" ||
    search.get("lp") === "true" ||
    search.get("flow") === "lp";
  const bolaoRaw = search.get("bolao");
  const bolao = ticketsPrincipalOnly
    ? "principal"
    : bolaoRaw === "diario" && !ticketsHideDaily
      ? "diario"
      : bolaoRaw === "extra"
        ? "extra"
        : "principal";
  const championshipParam = search.get("championshipId");
  const parsedChamp = championshipParam ? Number.parseInt(championshipParam, 10) : NaN;
  const initialExtraChampionshipId =
    bolao === "extra" && Number.isFinite(parsedChamp) && parsedChamp > 0 ? parsedChamp : undefined;

  const initialTicketKind =
    bolao === "diario" ? "daily" : bolao === "extra" && initialExtraChampionshipId != null ? "extra" : "general";

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-black">
      {lpFlow ? (
        <LpTicketCheckoutFlow />
      ) : (
        <TicketCheckoutFlow
          key={`${bolao}-${initialExtraChampionshipId ?? ""}-${ticketsPrincipalOnly ? "principal" : ticketsExtraOnly ? "xo" : ticketsHideDaily ? "hd" : "all"}`}
          initialTicketKind={initialTicketKind}
          initialExtraChampionshipId={initialExtraChampionshipId}
          serverExtraChampionshipIds={serverExtraChampionshipIds}
          ticketsExtraOnly={ticketsExtraOnly}
          ticketsHideDaily={ticketsHideDaily}
          ticketsPrincipalOnly={ticketsPrincipalOnly}
        />
      )}
    </div>
  );
}

export function TicketsPageClient({
  serverExtraChampionshipIds = [],
  ticketsExtraOnly = false,
  ticketsHideDaily = false,
  ticketsPrincipalOnly = false,
}: {
  serverExtraChampionshipIds?: number[];
  ticketsExtraOnly?: boolean;
  ticketsHideDaily?: boolean;
  ticketsPrincipalOnly?: boolean;
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
        ticketsHideDaily={ticketsHideDaily || ticketsPrincipalOnly}
        ticketsPrincipalOnly={ticketsPrincipalOnly}
      />
    </Suspense>
  );
}
