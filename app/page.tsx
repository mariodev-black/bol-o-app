import type { Metadata } from "next";
import { HomePageClient } from "@/app/components/HomePageClient";
import { buildPageMetadata } from "@/lib/seo/config";
import { HomePageJsonLd } from "@/lib/seo/json-ld";
import {
  getOutrosBoloesChampionshipIds,
  getOutrosBoloesGridItems,
  type OutrosBolaoGridItem,
} from "@/lib/boloes-outros-grid";
import { countParticipantsByExtraChampionshipIds } from "@/lib/predictions";
import type { PalpiteAbertoMatch } from "@/lib/home-palpites-abertos";
import { loadHomePalpitesAbertosFromCache } from "@/lib/home-palpites-abertos.server";
import { isBrasilEgitoPlacarPromoEnabled } from "@/lib/promotions/brasil-egito-placar-promo";

export const metadata: Metadata = buildPageMetadata({
  title: "Bolão do Milhão — Bolão da Copa 2026 | Mais de R$ 1 milhão em prêmios",
  description:
    "Entre no Bolão do Milhão, o bolão da Copa 2026 mais disputado do Brasil. Palpites nos jogos, ranking ao vivo, prêmios milionários e cota por R$ 39,90. Cadastre-se grátis e garanta sua vaga.",
  path: "/",
});

export default async function HomePage() {
  const ids = getOutrosBoloesChampionshipIds();
  const [counts, palpites] = await Promise.all([
    countParticipantsByExtraChampionshipIds(ids).catch(
      () => ({} as Record<number, number>),
    ),
    loadHomePalpitesAbertosFromCache(2).catch(
      () => [] as PalpiteAbertoMatch[],
    ),
  ]);
  const outrosBoloes: OutrosBolaoGridItem[] = getOutrosBoloesGridItems(counts);
  const palpitesAbertos = palpites;

  return (
    <>
      <HomePageJsonLd />
      <HomePageClient
        outrosBoloes={outrosBoloes}
        palpitesAbertos={palpitesAbertos}
        brasilEgitoPlacarPromoEnabled={isBrasilEgitoPlacarPromoEnabled()}
      />
    </>
  );
}
