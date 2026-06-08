import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SkaleCheckoutClient } from "@/app/skale/SkaleCheckoutClient";
import { buildPageMetadata } from "@/lib/seo/config";
import {
  getSkaleBolaoCompetitionId,
  getSkaleBolaoUnitCents,
  isSkaleBolaoEnabled,
  SKALE_BOLAO_DISPLAY_NAME,
} from "@/lib/boloes/skale-config";
import { isConfiguredExtraChampionshipId } from "@/lib/boloes-extra-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: `${SKALE_BOLAO_DISPLAY_NAME} — Bolão do Milhão`,
  description:
    "Garanta sua cota no Bolão Skale. Pool exclusivo da Copa do Mundo 2026 com palpites em todos os jogos e ranking dedicado.",
  path: "/skale",
});

export default function SkaleCheckoutPage() {
  if (!isSkaleBolaoEnabled()) {
    redirect("/boloes");
  }

  const championshipId = getSkaleBolaoCompetitionId();
  if (!isConfiguredExtraChampionshipId(championshipId)) {
    redirect("/boloes");
  }

  return (
    <SkaleCheckoutClient
      championshipId={championshipId}
      unitCents={getSkaleBolaoUnitCents()}
      displayName={SKALE_BOLAO_DISPLAY_NAME}
    />
  );
}
