"use client";

import { Header } from "@/app/shared/Header";
import { HomePageContainer } from "@/app/shared/HomePageContainer";
import { NavBottom } from "@/app/shared/NavBottom";
import Image from "next/image";
import Link from "next/link";
import bannerHomeLoggedIn from "@/app/assets/banner-chekout-v2.png";
import { HomeFromRedirectWhenLoggedIn } from "@/app/shared/HomeFromRedirectWhenLoggedIn";
import { HomeBrasilEgitoPromoFlow } from "@/app/components/HomeBrasilEgitoPromoFlow";
import { Suspense, useEffect, useState } from "react";
import { BRASIL_EGITO_PLACAR_FRIENDS_GOAL } from "@/lib/promotions/brasil-egito-guest-flow";
import { OutrosBoloesGrid } from "@/app/(authenticated)/boloes/_components/OutrosBoloesGrid";
import { QuemEstaNoBolaoSection } from "@/app/components/QuemEstaNoBolaoSection";
import { PalpitesAbertosGrid } from "@/app/components/PalpitesAbertosGrid";
import { HomeComoFuncionaPontuacaoSection } from "@/app/components/HomeComoFuncionaPontuacaoSection";
import { ScoringExplainerModal } from "@/app/shared/ScoringExplainerModal";
import { HomeClassificacaoCtaSection } from "@/app/components/HomeClassificacaoCtaSection";
import type { PalpiteAbertoMatch } from "@/lib/home-palpites-abertos";
import {
  collectPalpitesAbertosFromPartidasPayload,
  pickPalpitesAbertosForHome,
} from "@/lib/home-palpites-abertos";
import type { OutrosBolaoGridItem } from "@/lib/boloes-outros-grid";

type PartidasResponse = {
  partidas?: Record<string, unknown>;
};

let loggedHomePalpitesCache: {
  at: number;
  matches: PalpiteAbertoMatch[];
} | null = null;
const LOGGED_HOME_PALPITES_CACHE_MS = 3 * 60 * 1000;

function LoggedInHome({
  outrosBoloes,
  palpitesAbertos: initialPalpitesAbertos,
}: {
  outrosBoloes: OutrosBolaoGridItem[];
  palpitesAbertos: PalpiteAbertoMatch[];
}) {
  const [palpitesAbertos, setPalpitesAbertos] = useState(
    initialPalpitesAbertos,
  );
  const [palpitesLoading, setPalpitesLoading] = useState(
    initialPalpitesAbertos.length === 0,
  );
  const [scoringExplainerOpen, setScoringExplainerOpen] = useState(false);

  useEffect(() => {
    setPalpitesAbertos(initialPalpitesAbertos);
    setPalpitesLoading(initialPalpitesAbertos.length === 0);
  }, [initialPalpitesAbertos]);

  useEffect(() => {
    let cancelled = false;
    async function loadPalpitesAbertos() {
      if (
        loggedHomePalpitesCache &&
        Date.now() - loggedHomePalpitesCache.at < LOGGED_HOME_PALPITES_CACHE_MS
      ) {
        if (!cancelled) {
          setPalpitesAbertos(loggedHomePalpitesCache.matches);
          setPalpitesLoading(false);
        }
        return;
      }

      const showLoading = palpitesAbertos.length === 0;
      if (showLoading) setPalpitesLoading(true);
      try {
        const response = await fetch("/api/partidas?allSynced=1", {
          cache: "force-cache",
        });
        const data = (await response
          .json()
          .catch(() => ({}))) as PartidasResponse;
        if (!response.ok) throw new Error("Falha ao carregar partidas");
        const all = collectPalpitesAbertosFromPartidasPayload(data.partidas);
        const picked = pickPalpitesAbertosForHome(all, 2);
        loggedHomePalpitesCache = { at: Date.now(), matches: picked };
        if (!cancelled) setPalpitesAbertos(picked);
      } catch {
        if (!cancelled) setPalpitesAbertos([]);
      } finally {
        if (!cancelled) setPalpitesLoading(false);
      }
    }
    void loadPalpitesAbertos();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HomePageContainer>
      <Suspense fallback={null}>
        <HomeFromRedirectWhenLoggedIn />
      </Suspense>
      <Header />
      <main className="min-h-screen bg-black pb-32 text-white">
        <section className="w-full pt-2">
          <div className="mx-auto w-full max-w-[430px] px-3.5">
            <Link
              href="/boloes"
              className="block overflow-hidden rounded-[16px] border border-white/8 bg-[#0a0a0a] shadow-[0_10px_36px_rgba(0,0,0,0.45)]"
              aria-label="Entre no maior bolão da Copa — ver bolões"
            >
              <Image
                src={bannerHomeLoggedIn}
                alt="Entre no maior bolão da Copa — mais de 1 milhão em premiações"
                className="h-auto w-full object-cover object-center"
                priority
                sizes="(max-width: 430px) 100vw, 430px"
                draggable={false}
              />
            </Link>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[430px] px-3.5">
          {outrosBoloes.length > 0 ? (
            <OutrosBoloesGrid items={outrosBoloes} className="mt-5" />
          ) : null}

          <QuemEstaNoBolaoSection className="mt-5" />

          <HomeComoFuncionaPontuacaoSection
            onVerMaisPontuacao={() => setScoringExplainerOpen(true)}
          />

          <PalpitesAbertosGrid
            matches={palpitesAbertos}
            loading={palpitesLoading}
            className="mt-5"
          />

          <HomeClassificacaoCtaSection />
        </div>
      </main>
      <ScoringExplainerModal
        open={scoringExplainerOpen}
        onOpenChange={setScoringExplainerOpen}
      />
      <Suspense fallback={null}>
        <NavBottom />
      </Suspense>
    </HomePageContainer>
  );
}

export function HomePageClient({
  outrosBoloes = [],
  palpitesAbertos = [],
  brasilEgitoPlacarPromoEnabled = false,
}: {
  outrosBoloes?: OutrosBolaoGridItem[];
  palpitesAbertos?: PalpiteAbertoMatch[];
  brasilEgitoPlacarPromoEnabled?: boolean;
}) {
  return (
    <>
      <LoggedInHome
        outrosBoloes={outrosBoloes}
        palpitesAbertos={palpitesAbertos}
      />
      {brasilEgitoPlacarPromoEnabled ? (
        <Suspense fallback={null}>
          <HomeBrasilEgitoPromoFlow
            friendsGoal={BRASIL_EGITO_PLACAR_FRIENDS_GOAL}
            promoEnabled
          />
        </Suspense>
      ) : null}
    </>
  );
}
