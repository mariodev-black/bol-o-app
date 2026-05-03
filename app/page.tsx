import { Header } from "@/app/shared/Header";
import { HomePageContainer } from "@/app/shared/HomePageContainer";
import { Footer } from "@/app/shared/Footer";
import { NavBottom } from "@/app/shared/NavBottom";
import { BarChart3, Trophy, Users } from "lucide-react";
import bgHeroDesktop from "@/app/assets/home-desk.png";
import bgPixel from "@/app/assets/bg-hero-pixels.png";

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

export default function HomePage() {
  return (
    <HomePageContainer>
      <Header />
      <div className="relative w-full">
        <div
          style={{
            backgroundImage: `url(${bgPixel.src})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
          }}
          className="font-helvetica-now-display grid w-full grid-cols-1 items-center gap-y-8 px-4 pt-5 text-white sm:px-6 md:px-8 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-0 lg:px-10 xl:gap-x-12 xl:px-14 2xl:px-20"
        >
          <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center gap-2.5 text-center sm:max-w-xl sm:gap-3 lg:mx-0 lg:max-w-none lg:items-start lg:gap-3.5 lg:text-left">
            <div className="hero-fluid-title font-black">
              <span className="block text-primary">O MAIOR BOLÃO</span>
              <span className="block text-white">DA COPA 2026</span>
            </div>
            <p className="hero-fluid-lead font-bold text-white">
              + de <span className="text-primary">R$1.000.000</span> em
              premiações
            </p>
            <p className="hero-fluid-body font-light text-white/95 lg:mx-0">
              Dê seus palpites, fique entre os 10% melhores e concorra a prêmios
              que podem mudar sua vida.
            </p>
            <button
              type="button"
              className="hero-fluid-cta animate-cta-pulse-glow relative mt-3 overflow-visible rounded-[14px] bg-primary px-7 py-3.5 font-bold text-[#0E141B] transition-[transform,box-shadow,background-color] duration-300 ease-out hover:-translate-y-0.5 hover:animate-none hover:bg-[#c4f43a] hover:shadow-[0_10px_40px_rgba(177,235,11,0.45)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:mt-4 sm:px-10 sm:py-4 lg:mt-5"
            >
              <span className="relative z-10">
                GARANTIR MINHA COTA R$ 49,90
              </span>
            </button>
            <div className="mt-6 flex w-full max-w-2xl flex-wrap justify-center gap-6 sm:mt-5 sm:flex-nowrap sm:gap-6 md:gap-8 lg:mt-8 lg:max-w-none lg:justify-start lg:gap-8 xl:gap-10">
              {HERO_STATS.map(({ icon: Icon, headline, subline }) => (
                <div
                  key={subline}
                  className="flex min-w-0 items-center gap-2.5"
                >
                  <div className="flex size-[clamp(2.75rem,4vw,3.25rem)] shrink-0 items-center justify-center rounded-full border border-primary/35 bg-black/50">
                    <Icon
                      className="size-[clamp(1.25rem,2.2vw,1.625rem)] text-primary"
                      strokeWidth={1.35}
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 text-left">
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
          <div className="flex h-full w-full items-end justify-end">
            <img
              src={bgHeroDesktop.src}
              alt="Bolão da Copa 2026 — premiação e ranking"
              className="w-full"
            />
          </div>
        </div>
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[324px] lg:left-1/2 lg:right-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.81) 61%, #000 76%, #000 100%)",
          }}
          aria-hidden
        />
      </div>
      <Footer />
      <NavBottom />
    </HomePageContainer>
  );
}
