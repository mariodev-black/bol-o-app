import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  CircleDollarSign,
  ShieldCheck,
  Smartphone,
  Users,
  Zap,
} from "lucide-react";
import bgPixels from "@/app/assets/bg-pixels-2.png";

const FEATURES: {
  title: string;
  body: string;
  icon: LucideIcon;
}[] = [
  {
    title: "100% SEGURO",
    body: "Plataforma segura e transparente. Seus dados e pagamentos protegidos.",
    icon: ShieldCheck,
  },
  {
    title: "COMUNIDADE GIGANTE",
    body: "Jogue contra milhares de pessoas e faça parte da maior comunidade da Copa.",
    icon: Users,
  },
  {
    title: "ADRENALINA PURA",
    body: "Cada jogo é uma nova chance de pontuar, subir no ranking e ganhar prêmios.",
    icon: Zap,
  },
  {
    title: "PRÊMIOS REAIS",
    body: "Mais de R$1 milhão em prêmios distribuídos entre os melhores colocados.",
    icon: CircleDollarSign,
  },
  {
    title: "100% MOBILE",
    body: "Acesse de qualquer lugar, envie palpites e acompanhe tudo pelo celular.",
    icon: Smartphone,
  },
];

export function WhyParticipateSection() {
  return (
    <section
      style={{
        backgroundImage: `url(${bgPixels.src})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }}
      id="por-que-participar"
      className="font-helvetica-now-display relative isolate overflow-hidden py-16 text-white sm:py-20 lg:py-28"
    >
      <div className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20">
        <h2 className="mx-auto flex max-w-[1100px] flex-col items-center gap-1 text-center uppercase leading-[1.1] tracking-tight sm:gap-1.5">
          <span className="text-[clamp(1rem,3.1vw,2rem)] font-black text-white">
            Por que participar do
          </span>
          <span className="text-[clamp(1.15rem,4vw,2.75rem)] font-black text-primary">
            Bolão do Milhão?
          </span>
        </h2>

        <div className="mx-auto mt-12 grid max-w-[1400px] grid-cols-2 gap-3 sm:mt-14 sm:gap-4 lg:mt-16 lg:grid-cols-5 lg:gap-5">
          {FEATURES.map(({ title, body, icon: Icon }, index) => (
            <article
              key={title}
              className={`flex flex-col rounded-2xl border border-white/[0.08] bg-[##000000B8]/90 px-4 py-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[2px] sm:px-5 sm:py-6 lg:min-h-[220px] ${
                index === 4 ? "col-span-2 lg:col-span-1" : ""
              }`}
            >
              <Icon
                className="size-9 shrink-0 text-primary sm:size-10"
                strokeWidth={1.35}
                aria-hidden
              />
              <h3 className="mt-4 text-[13px] font-bold uppercase leading-snug tracking-wide text-white sm:text-sm">
                {title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed font-light text-[#a1a1aa] sm:text-[14px]">
                {body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
