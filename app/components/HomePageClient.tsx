"use client";

import { Header } from "@/app/shared/Header";
import { HomePageContainer } from "@/app/shared/HomePageContainer";
import { NavBottom } from "@/app/shared/NavBottom";
import { DesktopSidebar } from "@/app/shared/DesktopSidebar";
import { HomeBannerCarousel } from "@/app/components/HomeBannerCarousel";
import { HomeFromRedirectWhenLoggedIn } from "@/app/shared/HomeFromRedirectWhenLoggedIn";
import { Suspense, useEffect, useState } from "react";
import { OutrosBoloesGrid } from "@/app/(authenticated)/boloes/_components/OutrosBoloesGrid";
import { QuemEstaNoBolaoSection } from "@/app/components/QuemEstaNoBolaoSection";
import { PalpitesAbertosGrid } from "@/app/components/PalpitesAbertosGrid";
import { HomeComoFuncionaPontuacaoSection } from "@/app/components/HomeComoFuncionaPontuacaoSection";
import { ScoringExplainerModal } from "@/app/shared/ScoringExplainerModal";
import { HomeClassificacaoCtaSection } from "@/app/components/HomeClassificacaoCtaSection";
import { ProximosBolaoCarousel } from "@/app/components/ProximosBolaoCarousel";
import { HomeFeatureBand } from "@/app/components/HomeFeatureBand";
import { HomeRankingTop5 } from "@/app/components/HomeRankingTop5";
import type { PalpiteAbertoMatch } from "@/lib/home-palpites-abertos";
import {
  collectPalpitesAbertosFromPartidasPayload,
  pickPalpitesAbertosForHome,
} from "@/lib/home-palpites-abertos";
import type { OutrosBolaoGridItem } from "@/lib/boloes-outros-grid";
import {
  LIVE_PARTIDAS_POLL_MS,
  partidasUrlWithLiveSync,
} from "@/lib/football/live-sync-client";

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
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function loadPalpitesAbertos(liveSync = false) {
      if (
        !liveSync &&
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
        const response = await fetch(
          partidasUrlWithLiveSync("/api/partidas", { allSynced: 1 }),
          { cache: "no-store" },
        );
        const data = (await response
          .json()
          .catch(() => ({}))) as PartidasResponse;
        if (!response.ok) throw new Error("Falha ao carregar partidas");
        const all = collectPalpitesAbertosFromPartidasPayload(data.partidas);
        const picked = pickPalpitesAbertosForHome(all, 15);
        loggedHomePalpitesCache = { at: Date.now(), matches: picked };
        if (!cancelled) setPalpitesAbertos(picked);
      } catch {
        if (!cancelled) setPalpitesAbertos([]);
      } finally {
        if (!cancelled) setPalpitesLoading(false);
      }
    }

    void loadPalpitesAbertos(true);
    intervalId = setInterval(() => void loadPalpitesAbertos(true), LIVE_PARTIDAS_POLL_MS);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <HomePageContainer>
      <Suspense fallback={null}>
        <HomeFromRedirectWhenLoggedIn />
      </Suspense>
      <Header />
      {/* Sidebar fixo — desktop only (fixed escapa do overflow-hidden do container) */}
      <aside
        className="fixed left-0 hidden h-screen w-[210px] flex-col lg:flex"
        style={{ top: 0, paddingTop: "var(--app-header-height, 80px)", zIndex: 35 }}
      >
        <DesktopSidebar className="flex-1" />
      </aside>
      <main className="min-h-screen bg-black pb-32 text-white lg:pl-[210px]">
        {/* ── Banner full-width no desktop, altura controlada ── */}
        <div className="mx-auto w-full max-w-[460px] px-3.5 pt-2 lg:mx-0 lg:max-w-none lg:px-6 lg:pt-4">
          <HomeBannerCarousel fullWidth />
        </div>

        <div className="mx-auto w-full max-w-[460px] px-3.5 lg:mx-0 lg:max-w-none lg:px-6">
          {/* Feature band */}
          <HomeFeatureBand promoEnabled={promoEnabled} className="mt-4" />

          {/* Promoção ativa (mobile extra card) */}
          {promoEnabled ? (
            <div className="lg:hidden">
              <PromoBrasilMarrocosHomeCard />
            </div>
          ) : null}

          {/* ── Desktop: 2 colunas | Mobile: stack ── */}
          <div className="mt-5 lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-6">

            {/* Coluna esquerda — Principais Bolões + Próximos Bolões */}
            <div className="space-y-5">
              {outrosBoloes.length > 0 ? (
                <OutrosBoloesGrid
                  items={outrosBoloes}
                  title="PRINCIPAIS BOLÕES"
                  className="mt-0"
                />
              ) : null}
              <ProximosBolaoCarousel />
            </div>

            {/* Coluna direita — TOP 5 RANKING + QUEM ESTÁ */}
            <div>
              <HomeRankingTop5 />
              <QuemEstaNoBolaoSection className="mt-5" />
            </div>
          </div>

          {/* Seção educacional + jogos */}
          <div className="mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
            {/* Coluna esquerda: Telegram/Ajuda + Partidas */}
            <div>
              <HomeClassificacaoCtaSection className="" />
              <PalpitesAbertosGrid
                matches={palpitesAbertos}
                loading={palpitesLoading}
                className="mt-5"
              />
            </div>
            {/* Coluna direita: Como funciona / Pontuação */}
            <HomeComoFuncionaPontuacaoSection
              className="mt-5 lg:mt-0"
              onVerMaisPontuacao={() => setScoringExplainerOpen(true)}
            />
          </div>
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
}: {
  outrosBoloes?: OutrosBolaoGridItem[];
  palpitesAbertos?: PalpiteAbertoMatch[];
}) {
  return (
    <LoggedInHome
      outrosBoloes={outrosBoloes}
      palpitesAbertos={palpitesAbertos}
    />
  );
}
