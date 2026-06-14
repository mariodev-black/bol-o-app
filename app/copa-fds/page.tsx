import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SkaleCheckoutClient } from "@/app/skale/SkaleCheckoutClient";
import { buildPageMetadata } from "@/lib/seo/config";
import {
  getWeekendBolaoCompetitionId,
  getWeekendBolaoUnitCents,
  isWeekendBolaoEnabled,
  WEEKEND_BOLAO_DISPLAY_NAME,
} from "@/lib/boloes/weekend-bolao-config";
import { isConfiguredExtraChampionshipId } from "@/lib/boloes-extra-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: `${WEEKEND_BOLAO_DISPLAY_NAME} — Bolão do Milhão`,
  description:
    "Bolão especial da Copa com todos os jogos de sábado e domingo. Inscrição R$ 100,00 — premiação 100% (60/30/10).",
  path: "/copa-fds",
});

export default function CopaFdsCheckoutPage() {
  if (!isWeekendBolaoEnabled()) {
    redirect("/boloes");
  }

  const championshipId = getWeekendBolaoCompetitionId();
  if (!isConfiguredExtraChampionshipId(championshipId)) {
    redirect("/boloes");
  }

  return (
    <SkaleCheckoutClient
      championshipId={championshipId}
      unitCents={getWeekendBolaoUnitCents()}
      displayName={WEEKEND_BOLAO_DISPLAY_NAME}
    />
  );
}
