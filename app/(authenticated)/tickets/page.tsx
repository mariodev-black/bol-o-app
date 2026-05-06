"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TicketCheckoutFlow } from "./_components/TicketCheckoutFlow";

function TicketsPageContent() {
  const search = useSearchParams();
  const bolao = search.get("bolao") === "diario" ? "diario" : "principal";
  const initialPrincipalQty = bolao === "diario" ? 0 : 2;
  const initialDiarioQty = bolao === "diario" ? 1 : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <TicketCheckoutFlow initialPrincipalQty={initialPrincipalQty} initialDiarioQty={initialDiarioQty} />
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <TicketsPageContent />
    </Suspense>
  );
}
