import Link from "next/link";
import { Header } from "@/app/shared/Header";
import { Footer } from "@/app/shared/Footer";
import { NavBottom } from "@/app/shared/NavBottom";
import { HeroCarousel } from "@/app/shared/HeroCarousel";
import { Button } from "@/app/(authenticated)/components/ui/button";
import { ExternalLink, ChevronRight } from "lucide-react";
import bgHome from "@/app/assets/bgHome.png";
import TacaText from "@/app/assets/taca-text.png";
import { FlagsMarquee } from "@/app/shared/FlagsMarquee";
import { InfluencersSection } from "@/app/shared/InfluencersSection";
import { ComoParticipar } from "@/app/shared/ComoParticipar";
import { SistemaPontuacao } from "@/app/shared/SistemaPontuacao";
import { RankingAtual } from "@/app/shared/RankingAtual";
import { PremiacaoBolao } from "@/app/shared/PremiacaoBolao";

export default function HomePage() {
  return (
    <div className="flex flex-col bg-background pt-16">
      <Header />

      {/* Banner carousel */}

      {/* Hero original */}
      <section
        className="relative flex items-center justify-center overflow-hidden bg-transparent">

        <div className="relative z-10 w-full max-w-4xl md:max-w-full  px-5 sm:px-10 py-8 flex flex-col items-center text-center">

          {/* Carousel dentro do container com bordas */}
          <div className="w-full rounded-2xl overflow-hidden mb-8" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <HeroCarousel />
          </div>

          <div className="flex items-center gap-3 mb-2">
            <span className="h-px w-8 bg-[#DAB682]/70 md:w-15" />
            <span
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold md:font-black uppercase tracking-normal text-nowrap"
              style={{
                background: "linear-gradient(90deg, #FFAF2F, #FFE8BA)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Bolão do Milhão
            </span>
            <span className="h-px w-8 bg-[#DAB682]/70 md:w-15" />
          </div>

          <h1 className="flex items-center justify-center gap-2 flex-wrap text-[20px] sm:text-3xl lg:text-5xl font-black text-white uppercase leading-tight tracking-tight md:mb-6">
            <span>Copa do Mundo</span>
            <img
              src={TacaText.src}
              alt="Troféu"
              className="inline-block h-7 sm:h-9 lg:h-12 w-auto object-contain"
              style={{ verticalAlign: "middle" }}
            />
            <span>2026</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-white/75 max-w-md leading-relaxed md:hidden block">
            Participe do maior bolão da copa e <br />{" "}
            <strong className="text-white font-bold">concorra a milhões</strong>
          </p>
          <p className="mt-5 text-base sm:text-lg text-white/75 max-w-md leading-relaxed md:flex gap-2 hidden w-full text-nowrap">
            Participe do maior bolão da copa e<strong className="text-white font-bold">concorra a milhões</strong>
          </p>

          <div
            className="mt-8 flex flex-row items-center gap-[2px] sm:gap-4 text-sm sm:text-base text-white/70 rounded-sm"
            style={{
              padding: "6.6px 26.5px",
              background: "linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25)) padding-box, linear-gradient(90deg, transparent 0%, rgba(180,140,50,0.5) 50%, transparent 100%) border-box",
              border: "1px solid transparent",
            }}
          >
            <span className="whitespace-nowrap">
              Participantes:{" "}
              <strong className="font-bold" style={{ color: "#DAB682" }}>124.582</strong>
            </span>
            <span className="text-white/20 shrink-0">|</span>
            <span className="whitespace-nowrap">
              Premiações:{" "}
              <strong className="font-bold" style={{ color: "#DAB682" }}>
                + de R$ 1 Milhão
              </strong>
            </span>
          </div>

          <div
            className="mt-8 flex items-center gap-2 rounded-full p-2 md:mt-14"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            <Button asChild size="lg" className="rounded-full px-10 text-base font-bold h-13 shadow-lg shadow-amber-500/20">
              <Link href="/cadastrar">Comprar Ticket por R$ 49</Link>
            </Button>
            <Link
              href="/cadastrar"
              aria-label="Abrir em nova aba"
              className="flex items-center justify-center h-13 w-13 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <ExternalLink className="w-5 h-5" />
            </Link>
          </div>

          <Button
            variant="ghost"
            asChild
            className="mt-4 rounded-full border border-white/20 text-white hover:bg-white/10 px-7 gap-1"
            style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          >
            <Link href="/ranking">
              Ver ranking{" "}
              <ChevronRight className="w-4 h-4" style={{ color: "#FFAF2F" }} />
            </Link>
          </Button>
        </div>
      </section>
      <FlagsMarquee />
      <InfluencersSection />
      <ComoParticipar />

      {/* Divisória com gradiente dourado */}
      <div className="flex justify-center px-5" style={{ backgroundColor: "#0E141B" }}>
        <div
          className="w-full max-w-md h-px"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(254,197,84,0.5) 50%, transparent 100%)",
          }}
        />
      </div>

      <SistemaPontuacao />
      <RankingAtual />
      <PremiacaoBolao />
      <Footer />
      <NavBottom />
    </div>
  );
}
