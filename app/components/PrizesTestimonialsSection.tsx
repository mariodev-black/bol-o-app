import Image from "next/image";
import { Star, Trophy } from "lucide-react";
import overlaySection from "@/app/assets/overlay-section.png";

const SECONDARY_PRIZES = [
  { label: "2º Lugar", value: "R$ 200.000" },
  { label: "3º Lugar", value: "R$ 100.000" },
  { label: "4º Lugar", value: "R$ 50.000" },
  { label: "5º - 10º", value: "R$ 1.500.000" },
] as const;

const CHART_BARS = [
  { topLabel: "50K", heightClass: "h-[72px] sm:h-[88px]" },
  { topLabel: "60K", heightClass: "h-[96px] sm:h-[118px]" },
  { topLabel: "50K", heightClass: "h-[120px] sm:h-[148px]" },
  { topLabel: "50K", heightClass: "h-[144px] sm:h-[178px]" },
] as const;

const TESTIMONIALS = [
  {
    name: "Caio Ribeiro",
    quote:
      "O Bolão do Milhão é diferente de tudo que já vi. Organização, tecnologia e muita diversão!",
  },
  {
    name: "Fred Bruno",
    quote:
      "Participei e já virei fã! A emoção de cada jogo é surreal. Recomendo demais!",
  },
  {
    name: "Gil do Vigor",
    quote:
      "É entretenimento de qualidade e ainda tem a chance de mudar de vida. Tô dentro!",
  },
] as const;

function SideOverlays() {
  /** Caixa fixa: o flip fica dentro dela (não some com overflow / origin). */
  const box =
    "pointer-events-none absolute z-0 h-[min(46vh,420px)] w-[min(56vw,248px)] max-w-[268px] select-none sm:h-[min(52vh,480px)] sm:w-[min(44vw,288px)] sm:max-w-[312px] lg:w-[min(32vw,360px)]";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-visible"
    >
      {/* Direita + topo: reta do PNG à direita do arquivo */}
      <div className={`${box} right-0 top-0`}>
        <Image
          src={overlaySection}
          alt=""
          fill
          sizes="(max-width: 1024px) 48vw, 380px"
          className="object-contain object-right-top opacity-[0.92]"
        />
      </div>
      {/* Esquerda + rodapé: mesmo encosto que o topo-direita (object-right-top), girado 180° no centro — fica dentro da caixa (scale+origin BL vazava / some) */}
      <div className={`${box} bottom-0 left-0`}>
        <Image
          src={overlaySection}
          alt=""
          fill
          sizes="(max-width: 1024px) 48vw, 380px"
          loading="eager"
          className="object-contain object-right-top opacity-[0.92] origin-center rotate-180"
        />
      </div>
    </div>
  );
}

export function PrizesTestimonialsSection() {
  return (
    <section
      id="premios-depoimentos"
      className="font-helvetica-now-display relative isolate overflow-hidden bg-transparent py-16 text-white sm:py-20 lg:py-24 w-full"
    >
      <SideOverlays />

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20">
        {/* Topo — dois cards */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
          {/* O que você está disputando */}
          <div className="flex flex-col rounded-[22px] border border-white/[0.08] bg-[#050b09]/95 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-6 lg:min-h-[280px]">
            <h3 className="mb-5 text-center text-[15px] font-bold uppercase tracking-wide text-white sm:text-base lg:mb-6">
              O que você está disputando
            </h3>

            <div className="flex flex-1 flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-8">
              <div className="mx-auto flex w-full max-w-[200px] flex-col items-center justify-center rounded-2xl border-2 border-primary/50 bg-[#061510] px-4 py-5 sm:max-w-[220px] lg:mx-0 lg:shrink-0">
                <Trophy
                  className="mb-3 size-10 text-white sm:size-11"
                  strokeWidth={1.25}
                  aria-hidden
                />
                <p className="text-center text-2xl font-black tabular-nums leading-none text-primary sm:text-3xl">
                  R$ 500.000
                </p>
                <p className="mt-2 text-center text-xs font-semibold uppercase tracking-wider text-white/80">
                  1º Lugar
                </p>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                {SECONDARY_PRIZES.map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-full border border-white/[0.06] bg-[#0a1512] px-4 py-2.5 sm:px-5 sm:py-3"
                  >
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-white/85 sm:text-sm">
                      {label}
                    </span>
                    <span className="shrink-0 text-right text-[12px] font-bold tabular-nums text-primary sm:text-sm">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* A premiação aumenta */}
          <div className="flex flex-col rounded-[22px] border border-white/[0.08] bg-[#050b09]/95 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-6 lg:min-h-[280px]">
            <h3 className="text-center text-[15px] font-bold uppercase leading-snug tracking-wide sm:text-lg lg:text-left">
              <span className="text-white">A premiação </span>
              <span className="text-primary">aumenta!</span>
            </h3>
            <p className="mx-auto mt-2 max-w-md text-center text-[13px] leading-relaxed text-white/70 sm:text-sm lg:mx-0 lg:text-left">
              Quanto mais cotas vendidas, maior o prêmio final.
            </p>

            <div className="mt-8 flex flex-1 items-end justify-center gap-3 sm:mt-10 sm:gap-5 lg:mt-12 lg:justify-between lg:px-2">
              {CHART_BARS.map(({ topLabel, heightClass }, i) => (
                <div
                  key={`bar-${topLabel}-${i}`}
                  className="flex w-[22%] max-w-[5.5rem] flex-col items-center gap-2 sm:max-w-none sm:gap-3"
                >
                  <span className="text-[11px] font-semibold tabular-nums text-white/75 sm:text-xs">
                    {topLabel}
                  </span>
                  <div
                    className={`w-full rounded-t-md bg-linear-to-t from-emerald-950 via-emerald-600 to-primary shadow-[0_0_24px_rgba(177,235,11,0.18)] ${heightClass}`}
                  />
                  <span className="text-[10px] font-bold text-white sm:text-xs">
                    R$ 500k
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Título central */}
        <h2 className="mx-auto mt-14 max-w-4xl text-center text-[clamp(1.35rem,4.2vw,2.75rem)] font-black uppercase leading-[1.12] tracking-tight sm:mt-16 lg:mt-20">
          <span className="text-white">Quem já está dentro, </span>
          <span className="text-primary">aprova!</span>
        </h2>

        {/* Depoimentos */}
        <div className="mx-auto mt-10 grid max-w-[1200px] grid-cols-1 gap-4 sm:mt-12 sm:gap-5 lg:mt-14 lg:grid-cols-3">
          {TESTIMONIALS.map(({ name, quote }) => (
            <article
              key={name}
              className="flex flex-col rounded-2xl border border-emerald-900/40 bg-[#071410] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-6 sm:py-6"
            >
              <p className="flex-1 text-[14px] leading-relaxed text-white/92 sm:text-[15px]">
                {quote}
              </p>
              <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/[0.06] pt-4">
                <span className="text-sm font-bold text-primary sm:text-base">
                  {name}
                </span>
                <div className="flex shrink-0 gap-0.5" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-4 fill-amber-400 text-amber-400 sm:size-[18px]"
                    />
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
