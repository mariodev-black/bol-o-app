"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppScreenLoading } from "@/app/shared/AppScreenLoading";
import { TicketCheckoutFlow } from "./_components/TicketCheckoutFlow";
import { LpTicketCheckoutFlow } from "./_components/LpTicketCheckoutFlow";

function TicketsPageContent({
  ticketsPrincipalAndDailyOnly = false,
  ticketsHideExtra = false,
}: {
  ticketsPrincipalAndDailyOnly?: boolean;
  ticketsHideExtra?: boolean;
}) {
  const search = useSearchParams();
  const lpFlow =
    search.get("lp") === "1" ||
    search.get("lp") === "true" ||
    search.get("flow") === "lp";
  const bolaoRaw = search.get("bolao");
  const ticketsArtilheirosOnly = bolaoRaw === "artilheiros";
  const initialSkaleDaily = bolaoRaw === "skale-diario";
  const initialTicketKind =
    ticketsArtilheirosOnly
      ? "artilheiros"
      : ticketsPrincipalAndDailyOnly && bolaoRaw === "diario"
        ? "daily"
        : "general";

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-black">
      {lpFlow ? (
        <LpTicketCheckoutFlow />
      ) : (
        <TicketCheckoutFlow
          key={
            ticketsArtilheirosOnly
              ? "artilheiros"
              : ticketsPrincipalAndDailyOnly
                ? "principal-daily"
                : "full-shop"
          }
          initialTicketKind={initialTicketKind}
          initialSkaleDaily={initialSkaleDaily}
          ticketsPrincipalAndDailyOnly={
            ticketsPrincipalAndDailyOnly && !ticketsArtilheirosOnly
          }
          ticketsHideExtra={ticketsHideExtra && !ticketsArtilheirosOnly}
          ticketsArtilheirosOnly={ticketsArtilheirosOnly}
        />
      )}
    </div>
  );
}

export function TicketsPageClient({
  ticketsPrincipalAndDailyOnly = false,
  ticketsHideExtra = false,
}: {
  ticketsPrincipalAndDailyOnly?: boolean;
  ticketsHideExtra?: boolean;
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
        ticketsPrincipalAndDailyOnly={ticketsPrincipalAndDailyOnly}
        ticketsHideExtra={ticketsHideExtra}
      />
    </Suspense>
  );
}
