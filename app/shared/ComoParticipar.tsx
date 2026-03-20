import Link from "next/link";
import { Button } from "@/app/(authenticated)/components/ui/button";
import { ExternalLink, ChevronRight } from "lucide-react";
import { IconsTicket, BollIcon, IconGrafic } from "@/app/components/Icons";

const STEPS = [
  {
    etapa: "ETAPA 1",
    label: "Compre seu ticket",
    icon: <IconsTicket />,
  },
  {
    etapa: "ETAPA 2",
    label: "Envie seus palpites",
    icon: <BollIcon />,
  },
  {
    etapa: "ETAPA 3",
    label: "Suba no ranking",
    icon: <IconGrafic />,
  },
];

export function ComoParticipar() {
  return (
    <section
      className="flex flex-col items-center px-5 pt-10 pb-16 w-full md:gap-8"
    >
      {/* Título com gradiente linear */}
      <h2
        className="w-full max-w-md text-3xl sm:text-5xl font-bold md:font-light text-center mb-8 leading-tight"
        style={{
          background: "linear-gradient(180deg, #FFF9F3 0%, #999692 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Como Participar?
      </h2>

      {/* Cards dos steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-5xl">
        {STEPS.map((step) => (
          <div
            key={step.etapa}
            className="flex items-center gap-5 rounded-2xl md:rounded-sm px-5 py-4 justify-center"
            style={{
              backgroundColor: "#3131311A",
              border: "1px solid #5656561A",
            }}
          >
            {/* Ícone */}
            <div className="shrink-0 w-12 h-12 flex items-center justify-center">
              {step.icon}
            </div>

            {/* Texto */}
            <div className="flex flex-col">
              <span
                className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                style={{ color: "#FEC554" }}
              >
                {step.etapa}
              </span>
              <span className="text-white text-[20px] font-medium leading-tight">
                {step.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Área com glow dourado + botões */}
      <div className="relative flex flex-col md:flex-row items-center justify-center mt-8 w-full max-w-2xl gap-3">
        {/* Glow blur dourado */}
        <div
          className="absolute left-1/2 -translate-x-1/2 md:bottom-[-60px]  bottom-0 pointer-events-none w-[340px] h-[180px] md:w-[600px] md:h-[250px]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(254,197,84,0.35) 0%, transparent 70%)",
            filter: "blur(28px)",
            zIndex: 0,
          }}
        />

        {/* Botão CTA */}
        <div
          className="relative z-10 flex items-center gap-2 rounded-full p-1.5 w-full md:w-auto"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <Button
            asChild
            size="lg"
            className="rounded-full flex-1 text-base font-bold h-13 shadow-lg shadow-amber-500/20"
          >
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

        {/* Ver ranking */}
        <Button
          variant="ghost"
          asChild
          className="relative z-10 rounded-full border border-white/20 text-white hover:bg-white/10 px-7 gap-1 h-13 w-full md:w-auto shrink-0"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        >
          <Link href="/ranking">
            Ver ranking
            <ChevronRight className="w-4 h-4" style={{ color: "#FFAF2F" }} />
          </Link>
        </Button>
      </div>
    </section>
  );
}
