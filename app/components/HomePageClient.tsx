"use client";

import { Header } from "@/app/shared/Header";
import { HomePageContainer } from "@/app/shared/HomePageContainer";
import { NavBottom } from "@/app/shared/NavBottom";
import Image from "next/image";
import Link from "next/link";
import bannerHomeLoggedIn from "@/app/assets/banner-chekout-v2.png";
import { HomeFromRedirectWhenLoggedIn } from "@/app/shared/HomeFromRedirectWhenLoggedIn";
import { HomeBrasilMarrocosPromoFlow } from "@/app/components/HomeBrasilMarrocosPromoFlow";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePromotionsHub } from "@/app/shared/PromotionsHubContext";
import {
  fetchBrasilMarrocosPlacarPromoStatus,
  peekBrasilMarrocosPlacarPromoStatus,
} from "@/app/shared/useBrasilMarrocosPlacarPromoStatus";
import {
  mustCompletePromoQuotaPurchase,
  type BrasilMarrocosPlacarPromoStatus,
} from "@/lib/promotions/brasil-marrocos-placar-promo-shared";
import { BRASIL_MARROCOS_PLACAR_FRIENDS_GOAL } from "@/lib/promotions/brasil-marrocos-guest-flow";
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

function PromoBrasilMarrocosHomeCard() {
  const router = useRouter();
  const { openPromotion, getPromotionPrefetch } = usePromotionsHub();

  const handleParticipar = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      void (async () => {
        let status: BrasilMarrocosPlacarPromoStatus | null =
          (getPromotionPrefetch("brasil_marrocos_placar") as
            | BrasilMarrocosPlacarPromoStatus
            | undefined) ??
          peekBrasilMarrocosPlacarPromoStatus();

        if (!status?.enabled) {
          status = await fetchBrasilMarrocosPlacarPromoStatus();
        }
        if (status && mustCompletePromoQuotaPurchase(status)) {
          router.push("/promo-camisa-brasil");
          return;
        }
        if (status?.showOfferModal) {
          openPromotion("brasil_marrocos_placar");
          return;
        }
        if (status?.promoActivated) {
          router.push("/boloes");
          return;
        }
        router.push("/promo-camisa-brasil");
      })();
    },
    [getPromotionPrefetch, openPromotion, router],
  );

  return (
    <a
      href="/promo-camisa-brasil"
      onClick={handleParticipar}
      className="mt-4 flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3"
      style={{ background: "#0d1a00", borderColor: "#B1EB0B55" }}
    >
      <div className="flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
          Promoção ativa
        </p>
        <p className="text-[15px] font-black uppercase leading-tight tracking-tight text-white">
          Palpite Brasil x Marrocos
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-white/60">
          Concorra à camisa oficial + R$&nbsp;1.000 no PIX
        </p>
      </div>
      <div
        className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-[#0E141B]"
        style={{ background: "#B1EB0B" }}
      >
        Participar
      </div>
    </a>
  );
}

function LoggedInHome({
  outrosBoloes,
  palpitesAbertos: initialPalpitesAbertos,
  promoEnabled = false,
}: {
  outrosBoloes: OutrosBolaoGridItem[];
  palpitesAbertos: PalpiteAbertoMatch[];
  promoEnabled?: boolean;
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
          {/* Promo highlight — shown when active */}
          {promoEnabled ? <PromoBrasilMarrocosHomeCard /> : null}

          {/* Palpites abertos — conteúdo mais dinâmico, em destaque */}
          <PalpitesAbertosGrid
            matches={palpitesAbertos}
            loading={palpitesLoading}
            className="mt-5"
          />

          {/* Outros bolões ativos */}
          {outrosBoloes.length > 0 ? (
            <OutrosBoloesGrid items={outrosBoloes} className="mt-5" />
          ) : null}

          <QuemEstaNoBolaoSection className="mt-5" />

          <HomeClassificacaoCtaSection />

          {/* Como funciona — conteúdo educacional, ao final */}
          <HomeComoFuncionaPontuacaoSection
            onVerMaisPontuacao={() => setScoringExplainerOpen(true)}
          />
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
  brasilMarrocosPlacarPromoEnabled = false,
}: {
  outrosBoloes?: OutrosBolaoGridItem[];
  palpitesAbertos?: PalpiteAbertoMatch[];
  brasilMarrocosPlacarPromoEnabled?: boolean;
}) {
  return (
    <>
      <LoggedInHome
        outrosBoloes={outrosBoloes}
        palpitesAbertos={palpitesAbertos}
        promoEnabled={brasilMarrocosPlacarPromoEnabled}
      />
      {brasilMarrocosPlacarPromoEnabled ? (
        <Suspense fallback={null}>
          <HomeBrasilMarrocosPromoFlow
            friendsGoal={BRASIL_MARROCOS_PLACAR_FRIENDS_GOAL}
            promoEnabled
          />
        </Suspense>
      ) : null}
    </>
  );
}
