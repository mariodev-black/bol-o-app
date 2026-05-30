"use client";

import { Header } from "@/app/shared/Header";
import { HomePageContainer } from "@/app/shared/HomePageContainer";
import { Footer } from "@/app/shared/Footer";
import { NavBottom } from "@/app/shared/NavBottom";
import { ScoreRulesCards } from "@/app/components/ScoreRulesCards";
import type { ScoreRuleItem } from "@/app/components/ScoreRulesCards";
import { RankingGaleraSection } from "@/app/components/RankingGaleraSection";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  ClipboardList,
  Medal,
  Newspaper,
  ScanSearch,
  Ticket,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import bollIcon from "@/app/assets/boll.svg";
import cifraoIcon from "@/app/assets/cifrao.svg";
import logo from "@/app/assets/logo.svg";
import iconInsta from "@/app/assets/icon-insta.svg";
import bgHeroDesktop from "@/app/assets/home-desk.png";
import bgPixel from "@/app/assets/bg-hero-pixels.png";
import bannerHomeLoggedIn from "@/app/assets/banner-chekout-v2.png";
import { FlagsMarquee } from "@/app/components/FlagsMarquee";
import { WhyParticipateSection } from "@/app/components/WhyParticipateSection";
import { PrizesTestimonialsSection } from "@/app/components/PrizesTestimonialsSection";
import { CopaCtaBandSection } from "@/app/components/CopaCtaBandSection";
import { HomeFaqSection } from "@/app/components/HomeFaqSection";
import { HomeFromRedirectWhenLoggedIn } from "@/app/shared/HomeFromRedirectWhenLoggedIn";
import { TicketPurchaseLink } from "@/app/shared/TicketPurchaseLink";
import { AppScreenLoading } from "@/app/shared/AppScreenLoading";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/shared/AuthContext";
import { useAppServerConfig } from "@/app/shared/AppServerConfigContext";
import { useProductHref } from "@/app/shared/useProductHref";
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
import type { HomePageServerHint } from "@/lib/home-page-server-hint";

const INSTAGRAM_W18_URL = "https://www.instagram.com/w18walter/";

const HERO_STATS = [
  {
    icon: Users,
    headline: "+100.000",
    subline: "participantes",
  },
  {
    icon: Trophy,
    headline: "R$1.000.000",
    subline: "em prêmios",
  },
  {
    icon: BarChart3,
    headline: "Ranking",
    subline: "em tempo real",
  },
] as const;

const HOW_IT_WORKS_STEPS = [
  {
    icon: Ticket,
    title: "COMPRE SEU TICKET",
    body: "Por apenas R$39,90, você garante sua vaga no maior bolão da Copa.",
  },
  {
    icon: ScanSearch,
    title: "ENVIE SEUS PALPITES",
    body: "Analise os jogos, use sua intuição e registre seus placares para cada partida.",
  },
  {
    icon: ChartNoAxesColumnIncreasing,
    title: "SUBA NO RANKING",
    body: "Acompanhe sua performance em tempo real e veja seu nome escalar rumo ao Top 10.",
  },
  {
    icon: Trophy,
    title: "CONCORRA A PRÊMIOS MILIONÁRIOS",
    body: "Os melhores colocados levam prêmios que podem mudar sua vida!",
  },
] as const;

const SCORE_TICKER_SEGMENTS = Array.from({ length: 50 }, (_, i) => i);

/** Barra lateral por índice — paleta verde coerente com o restante da seção */
const SCORE_CARD_ACCENTS = [
  "linear-gradient(180deg, #e8ff4a 0%, #9fdb3a 55%, #5cb032 100%)",
  "linear-gradient(180deg, #6ee7b7 0%, #34d399 50%, #059669 100%)",
  "linear-gradient(180deg, #86efac 0%, #22c55e 55%, #166534 100%)",
  "linear-gradient(180deg, #d9f99d 0%, #a3e635 45%, #65a30d 100%)",
  "linear-gradient(180deg, #5eead4 0%, #14b8a6 50%, #0f766e 100%)",
] as const;

const SCORE_RULES: ScoreRuleItem[] = [
  {
    badge: "Placar exato",
    badgeClass:
      "rounded-full bg-[#C6FF00] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#0A1F1F] shadow-[0_2px_12px_rgba(198,255,0,0.35)]",
    points: "+6 pontos",
  },
  {
    badge: "Vencedor + gols de 1 time",
    badgeClass:
      "rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm",
    points: "+4 pontos",
  },
  {
    badge: "Acertou o vencedor",
    badgeClass:
      "rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm",
    points: "+3 pontos",
  },
  {
    badge: "Gols de 1 time",
    badgeClass:
      "rounded-full border border-white/12 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white",
    points: "+1 ponto",
  },
];

const QUICK_ACTIONS = [
  {
    title: "Meus Bolões",
    desc: "Cotas, status e palpites",
    href: "/boloes",
    icon: Trophy,
  },
  {
    title: "Jogos do Dia",
    desc: "Palpite antes de fechar",
    href: "/boloes",
    icon: CalendarDays,
  },
  {
    title: "Ranking",
    desc: "Veja sua posição",
    href: "/ranking",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    title: "Notícias",
    desc: "Fique por dentro",
    href: "/premiacao",
    icon: Newspaper,
  },
] as const;

type PartidasResponse = {
  partidas?: Record<string, unknown>;
};

let loggedHomePalpitesCache: {
  at: number;
  matches: PalpiteAbertoMatch[];
} | null = null;
const LOGGED_HOME_PALPITES_CACHE_MS = 3 * 60 * 1000;

function HomeStatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Trophy;
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-h-[72px] p-3 flex-col items-center justify-center border-r border-white/8 px-2 text-center last:border-r-0">
      <Icon className="size-5 text-primary" strokeWidth={2.1} />
      <p className="mt-2 text-[16px] font-black leading-none text-primary">
        {value}
      </p>
      <p className="mt-1 text-[14px] font-black uppercase tracking-[0.07em] text-white/82">
        {label}
      </p>
    </div>
  );
}

function QuickActionCard({
  title,
  desc,
  href,
  icon: Icon,
}: (typeof QUICK_ACTIONS)[number]) {
  return (
    <Link
      href={href}
      className="group min-w-0 rounded-[12px] border border-white/8 bg-[#111] p-2.5 shadow-[0_10px_22px_rgba(0,0,0,0.34)] active:scale-[0.98]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-primary/25 bg-primary/10">
          <Icon className="size-4 text-primary" strokeWidth={2.2} />
        </span>
      </div>
      <p className="mt-2 truncate text-[16px] font-black uppercase leading-tight text-white">
        {title}
      </p>
      <p className="mt-1 line-clamp-2 text-[14px] font-medium leading-snug text-white/80">
        {desc}
      </p>
    </Link>
  );
}

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
        <section className="w-full pt-1">
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
  hint,
  outrosBoloes = [],
  palpitesAbertos = [],
}: {
  hint: HomePageServerHint;
  outrosBoloes?: OutrosBolaoGridItem[];
  palpitesAbertos?: PalpiteAbertoMatch[];
}) {
  const router = useRouter();
  const { ready, isLoggedIn } = useAuth();
  const { subdomainRoutingEnabled, appOrigin } = useAppServerConfig();
  const onAppHost = hint.onApp;
  const onMarketing = hint.onMarketing;
  /** Até o `/me` no client: confia no cookie validado no servidor (sem flash da LP). */
  const loggedIn = ready ? isLoggedIn : hint.initialLoggedIn;

  useEffect(() => {
    if (!onAppHost || !ready || isLoggedIn) return;
    router.replace("/cadastrar");
  }, [onAppHost, ready, isLoggedIn, router]);

  useEffect(() => {
    if (!ready || !isLoggedIn || onAppHost) return;
    if (subdomainRoutingEnabled && onMarketing) {
      window.location.assign(`${appOrigin.replace(/\/+$/, "")}/`);
    }
  }, [
    ready,
    isLoggedIn,
    onAppHost,
    onMarketing,
    subdomainRoutingEnabled,
    appOrigin,
  ]);

  /** App: home logada em `/`; visitante → cadastro (nunca LP). */
  if (onAppHost) {
    if (!loggedIn) {
      if (!ready) return <AppScreenLoading message="Carregando..." />;
      return null;
    }
    return (
      <LoggedInHome
        outrosBoloes={outrosBoloes}
        palpitesAbertos={palpitesAbertos}
      />
    );
  }

  /** www: logado vai para o app; visitante vê LP. */
  if (loggedIn) {
    if (subdomainRoutingEnabled && onMarketing) {
      return <AppScreenLoading message="Abrindo o app..." />;
    }
    return (
      <LoggedInHome
        outrosBoloes={outrosBoloes}
        palpitesAbertos={palpitesAbertos}
      />
    );
  }

  return <PublicHome />;
}

function PublicHome() {
  return (
    <HomePageContainer>
      <Header />
      <div className="relative w-full mb-12">
        <div
          style={{
            backgroundImage: `url(${bgPixel.src})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="font-helvetica-now-display grid w-full grid-cols-1 items-center gap-y-8 px-4 pt-5 text-white sm:px-6 md:px-8 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-0 lg:px-10 xl:gap-x-12 xl:px-14 2xl:px-0 mx-auto max-w-[1500px]">
            <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center gap-2.5 text-center sm:max-w-xl sm:gap-3 lg:mx-0 lg:max-w-none lg:items-start lg:gap-3.5 lg:text-left">
              <Link
                href="/"
                className="my-5 flex justify-center lg:hidden"
                aria-label="Bolão do Milhão"
              >
                <Image
                  src={logo}
                  alt="Bolão do Milhão"
                  width={168}
                  height={44}
                  quality={100}
                  sizes="168px"
                  priority
                  className="h-[40px] w-auto"
                />
              </Link>
              <h1 className="hero-fluid-title font-black">
                <span className="block text-primary">O MAIOR BOLÃO</span>
                <span className="block text-white">DA COPA 2026</span>
              </h1>
              <p className="hero-fluid-lead font-bold text-white">
                + de <span className="text-primary">R$1.000.000</span> em
                premiações
              </p>
              <p className="hero-fluid-body font-light text-white/95 lg:mx-0">
                Dê seus palpites, fique entre os 10% melhores e concorra a
                prêmios que podem mudar sua vida.
              </p>
              <TicketPurchaseLink
                ariaLabel="Garantir Minha Participação"
                className="hero-fluid-cta cta-pulse-ring relative mt-3 overflow-visible rounded-[14px] bg-primary px-7 py-3.5 font-bold text-[#0E141B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:mt-4 sm:px-10 sm:py-4 lg:mt-5"
              >
                <span className="relative z-10">
                  Garantir Minha Participação R$ 39,90
                </span>
              </TicketPurchaseLink>
              <div className="mt-6 grid w-full max-w-2xl grid-cols-3 gap-x-2 gap-y-3 sm:mt-5 sm:flex sm:max-w-2xl sm:flex-nowrap sm:justify-center sm:gap-x-6 sm:gap-y-0 md:gap-x-8 lg:mt-8 lg:max-w-none lg:justify-start lg:gap-x-8 xl:gap-x-10">
                {HERO_STATS.map(({ icon: Icon, headline, subline }) => (
                  <div
                    key={subline}
                    className="flex min-w-0 flex-col items-center gap-1.5 text-center sm:flex-row sm:items-center sm:gap-2.5 sm:text-left"
                  >
                    <div className="flex size-[clamp(2.75rem,4vw,3.25rem)] shrink-0 items-center justify-center rounded-full border border-primary/35 bg-black/50">
                      <Icon
                        className="size-[clamp(1.25rem,2.2vw,1.625rem)] text-primary"
                        strokeWidth={1.35}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="hero-fluid-stat-head font-bold leading-tight text-primary">
                        {headline}
                      </p>
                      <p className="hero-fluid-stat-sub font-light leading-tight text-white/90">
                        {subline}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative flex h-full w-full items-end justify-center">
              <img
                src={bgHeroDesktop.src}
                alt="Bolão da Copa 2026 — premiação e ranking"
                className="w-full"
              />
              <a
                href={INSTAGRAM_W18_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Seguir @w18walter no Instagram"
                className="group absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5 sm:bottom-5 lg:bottom-6"
              >
                <span className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/80 shadow-[0_0_20px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-all duration-200 group-hover:scale-105 group-hover:border-white/30 group-hover:shadow-[0_0_28px_rgba(0,0,0,0.55)] sm:size-12">
                  <Image
                    src={iconInsta}
                    alt=""
                    width={26}
                    height={26}
                    className="size-6 object-contain transition-transform duration-200 group-hover:scale-110 sm:size-7"
                    aria-hidden
                  />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 transition-colors group-hover:text-primary sm:text-[11px]">
                  @w18walter
                </span>
              </a>
            </div>
          </div>
        </div>
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 lg:left-[51.3%] lg:right-0 lg:h-[324px]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.81) 61%, #000 76%, #000 100%)",
          }}
          aria-hidden
        />
      </div>
      <section
        id="como-funciona"
        className="font-helvetica-now-display bg-black px-4 py-0 text-white sm:px-6 md:py-16 lg:px-10 lg:py-20 xl:px-14 2xl:px-20 pb-10"
      >
        <div className="mx-auto max-w-[1500px]">
          {/* Desktop: space-between — espaço igual entre título | bola | texto */}
          <div className="mb-20 hidden w-full items-start justify-between lg:flex">
            <header className="min-w-0 max-w-lg shrink text-left xl:max-w-xl">
              <h2 className="text-[60px] font-bold leading-tight tracking-tight">
                <span className="text-white">Como </span>
                <span className="text-primary">Funciona:</span>
              </h2>
              <p className="mt-3 text-[24px] leading-snug font-light text-white">
                é simples, <em className="font-medium italic">rápido</em> e{" "}
                <span className="font-medium ">emocionante!</span>
              </p>
            </header>
            <div className="flex shrink-0 justify-center self-start pt-1">
              <Image
                src={bollIcon}
                alt=""
                width={112}
                height={112}
                className="h-22 w-22 object-contain xl:h-28 xl:w-28"
                priority={false}
              />
            </div>
            <p className="min-w-0 max-w-lg shrink text-left text-[24px] leading-relaxed font-light text-white xl:max-w-[620px]">
              Participar do Bolão do Milhão é fácil e garante a sua imersão
              total na Copa do Mundo 2026.{" "}
              <span className="font-medium text-primary">
                Siga estes quatro passos
              </span>{" "}
              e comece a trilhar seu caminho rumo aos milhões:
            </p>
          </div>

          {/* Mobile: bola em cima, títulos e texto centralizados */}
          <div className="mb-10 flex flex-col items-center text-center lg:hidden">
            <Image
              src={bollIcon}
              alt=""
              width={50}
              height={50}
              className="mb-6 h-12 w-12 md:h-24 md:w-24 object-contain"
            />
            <h2 className="text-[32px] font-bold leading-tight tracking-tight">
              <span className="text-white">Como </span>
              <span className="text-primary">Funciona</span>
            </h2>
            <p className="mt-3 max-w-md text-[20px] leading-snug font-light text-white">
              <span className="text-white/70">é simples, </span>
              <em className="italic text-white/70">rápido</em>
              <span className="text-white/70"> e </span>
              <span className="font-bold text-white">emocionante!</span>
            </p>
            <p className="mt-6 max-w-lg text-[16px] leading-relaxed font-light text-white">
              Participar do Bolão do Milhão é fácil e garante a sua imersão
              total na Copa do Mundo 2026.{" "}
              <span className="font-medium text-primary">
                Siga estes quatro passos
              </span>{" "}
              e comece a trilhar seu caminho rumo aos milhões:
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 lg:gap-6 xl:gap-7">
            {HOW_IT_WORKS_STEPS.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <article className="flex h-full flex-col items-center justify-center rounded-[18.49px] md:rounded-[29.16px] border-2 border-[#171B1A] bg-[#101010] px-4 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-8 sm:py-11">
                  <div className="mb-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-primary/45 bg-[#B1EB0B17] text-primary shadow-[0_0_26px_rgba(177,235,11,0.22),0_0_40px_rgba(177,235,11,0.06)] sm:mb-7 sm:h-14 sm:w-14 sm:rounded-2xl">
                    <Icon
                      className="h-4 w-4 sm:h-7 sm:w-7"
                      strokeWidth={1.35}
                      aria-hidden
                    />
                  </div>
                  <h3 className="text-pretty text-[18px] font-bold uppercase leading-snug tracking-wide text-white sm:text-[29px] sm:leading-tight">
                    {title}
                  </h3>
                  <p className="mt-4 text-pretty text-[14px] leading-relaxed font-light text-[#C4C4CF] sm:text-[22px]">
                    {body}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="sistema-pontos"
        className="font-helvetica-now-display bg-[#EBEBEB] text-[#0A1F1F] w-full"
      >
        <div className="overflow-hidden bg-[#C6FF00] py-2.5 md:py-3">
          <div className="flex animate-marquee">
            {[...SCORE_TICKER_SEGMENTS, ...SCORE_TICKER_SEGMENTS].map(
              (_, idx) => (
                <span
                  key={idx}
                  className="inline-flex shrink-0 items-center gap-4 px-6 md:gap-5 md:px-8"
                >
                  <span className="whitespace-nowrap text-sm font-bold tracking-wide text-[#0A1F1F] md:text-base">
                    O Top 10 ganha prêmios milionários!
                  </span>
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0f291c] md:h-10 md:w-10">
                    <Image
                      src={cifraoIcon}
                      alt=""
                      width={22}
                      height={22}
                      className="h-5 w-5 object-contain md:h-6 md:w-6"
                    />
                  </span>
                </span>
              ),
            )}
          </div>
        </div>

        <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6 md:py-16 lg:px-10 lg:py-20 xl:px-14 2xl:px-20">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-20">
            <div className="mx-auto max-w-xl overflow-visible pt-4 text-center sm:pt-6 lg:mx-0 lg:pt-2 lg:text-left">
              <h2 className="relative z-1 flex w-full max-w-full flex-col items-center pb-1 font-bold leading-[1.02] tracking-tight text-[#021C1A] lg:items-start">
                <span className="block text-[62.13px] leading-[1.02] sm:text-[clamp(2.25rem,6.5vw,6.375rem)]">
                  Cada acerto
                </span>
                <div className="relative mx-auto mt-0 inline-block w-max max-w-full lg:mx-0">
                  <span className="block text-[62.13px] leading-[1.02] sm:text-[clamp(2.25rem,6.5vw,6.375rem)]">
                    te aproxima
                  </span>
                  <span className="mt-0 block text-[62.13px] leading-[1.02] sm:text-[clamp(2.25rem,6.5vw,6.375rem)]">
                    do milhão!
                  </span>
                  {/* Mobile: à direita, junto a “milhão”; sm+: canto superior direito do bloco */}
                  <span
                    className="animate-cifrao-float pointer-events-none absolute z-20 max-sm:size-[48.335483302724136px] max-sm:right-[5%] max-sm:-top-[6%] sm:-top-[8%] sm:right-[8%] sm:h-18 sm:w-18"
                    aria-hidden
                  >
                    <Image
                      src={cifraoIcon}
                      alt=""
                      width={49}
                      height={49}
                      className="h-full w-full object-contain -rotate-17 sm:-rotate-190"
                    />
                  </span>
                  {/* Mobile: à esquerda, sobre “te aproxima”; sm+: esquerda do bloco */}
                  <span
                    className="animate-cifrao-float pointer-events-none absolute z-20 max-sm:size-[48.335483302724136px] [animation-delay:2.4s] max-sm:left-[16%] max-sm:top-[40%] sm:top-[38%] sm:left-[14%] sm:h-18 sm:w-18"
                    aria-hidden
                  >
                    <Image
                      src={cifraoIcon}
                      alt=""
                      width={49}
                      height={49}
                      className="h-full w-full object-contain -rotate-130 sm:-rotate-130"
                    />
                  </span>
                </div>
              </h2>
              <p className="mx-auto mt-6 max-w-[510px] text-[18px] leading-relaxed font-light text-[#2d3436] sm:text-[28px] sm:font-light lg:mx-0">
                Nosso sistema de pontuação é{" "}
                <strong className="font-bold text-[#0A1F1F]">
                  transparente e justo
                </strong>
                , recompensando sua precisão e conhecimento sobre futebol
              </p>
            </div>

            <ScoreRulesCards
              rules={SCORE_RULES}
              accents={SCORE_CARD_ACCENTS}
              heroSrc={bgHeroDesktop.src}
            />
          </div>
        </div>
      </section>
      <RankingGaleraSection />
      <FlagsMarquee />
      <WhyParticipateSection />
      <PrizesTestimonialsSection />
      <CopaCtaBandSection />
      <HomeFaqSection />
      <Footer />
    </HomePageContainer>
  );
}
