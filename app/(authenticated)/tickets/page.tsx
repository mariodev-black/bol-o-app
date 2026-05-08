"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TicketCheckoutFlow } from "./_components/TicketCheckoutFlow";

function TicketsPageContent() {
  const search = useSearchParams();
  const bolao = search.get("bolao") === "diario" ? "diario" : "principal";

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TicketCheckoutFlow key={bolao} initialTicketKind={bolao === "diario" ? "daily" : "general"} />
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
