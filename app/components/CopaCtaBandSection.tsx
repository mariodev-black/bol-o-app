import Image from "next/image";
import { CircleDollarSign, ShieldCheck, Users, Zap } from "lucide-react";
import bgHeroDesktop from "@/app/assets/bg-bottom.png";
import { TicketPurchaseLink } from "@/app/shared/TicketPurchaseLink";

const BAND_STATS = [
  {
    icon: Users,
    headline: "+100.000",
    subline: "Participantes",
  },
  {
    icon: Zap,
    headline: "+300.000",
    subline: "Palpites enviados",
  },
  {
    icon: CircleDollarSign,
    headline: "+1.000.000",
    subline: "Em premiações",
  },
  {
    icon: ShieldCheck,
    headline: "100%",
    subline: "Confiável e seguro",
  },
] as const;

export function CopaCtaBandSection() {
  return (
    <section
      id="cotas"
      aria-labelledby="copa-cta-heading"
      className="font-helvetica-now-display relative isolate w-full overflow-hidden text-white"
    >
      <div className="absolute inset-0">
        <Image
          src={bgHeroDesktop}
          alt=""
          fill
          className="object-cover object-[center_35%]"
          sizes="100vw"
          priority={false}
        />
        <div
          className="absolute inset-0 bg-linear-to-b from-black/75 via-black/55 to-black"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_45%,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.65)_55%,#000_100%)]"
          aria-hidden
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1500px] px-4 py-14 sm:px-6 sm:py-16 md:py-20 lg:px-10 lg:py-24 xl:px-14 2xl:px-16">
        <div className="mx-auto grid w-full max-w-[980px] grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,520px)_372px] lg:gap-10 xl:gap-12">
          <div className="max-w-xl text-center lg:mx-0 lg:max-w-none lg:text-left">
            <p className="text-sm font-light leading-snug text-white/85 sm:text-[20px]">
              A copa acontece a cada 4 anos. O dinheiro vai circular.
            </p>
            <p className="mt-3 text-lg font-bold text-white sm:text-[36px]">
              A pergunta é
            </p>
            <h2
              id="copa-cta-heading"
              className="mt-4 text-[clamp(1.85rem,5vw,3.4rem)] font-black leading-[1.08] tracking-tight sm:mt-5"
            >
              <span className="block text-primary">Você vai entrar</span>
              <span className="block text-white">ou só assistir?</span>
            </h2>
          </div>

          <div className="mx-auto w-full max-w-[372px] lg:mx-0 lg:justify-self-start">
            <div className="relative flex flex-col items-center overflow-hidden rounded-[22px] border border-primary bg-[#00251f] px-4 pb-8 pt-8 shadow-[0_0_0_1px_rgba(177,235,11,0.08),0_22px_70px_rgba(0,0,0,0.35)] sm:px-9 sm:pt-9">
              <div
                className="pointer-events-none absolute inset-x-8 bottom-[96px] h-28 bg-[radial-gradient(ellipse_at_center,rgba(177,235,11,0.16)_0%,rgba(0,158,111,0.12)_36%,rgba(0,0,0,0)_74%)] blur-xl"
                aria-hidden
              />
              <p className="relative text-center text-[22px] font-black uppercase leading-tight tracking-[-0.04em] text-white sm:text-[21px]">
                Garanta sua cota agora!
              </p>
              <p className="relative mt-7 text-center text-[14px] font-light leading-none text-white/90">
                Por apenas
              </p>
              <p className="relative mt-5 mb-4 bg-linear-to-r from-[#F7FFD9] via-[#DFFF76] to-primary bg-clip-text text-center text-[56px] font-black tabular-nums leading-none tracking-[-0.06em] text-transparent sm:text-[58px]">
                R$ 49,90
              </p>
              <TicketPurchaseLink
                ariaLabel="Garantir minha cota"
                className="cta-pulse-ring w-full relative  overflow-visible rounded-xl bg-primary px-4 py-4 text-[15px] font-bold leading-tight tracking-tight text-[#0E141B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:mt-2.5 sm:px-5 sm:py-4 sm:text-[15px]"
              >
                <span className="relative z-10">
                  GARANTIR MINHA COTA R$ 49,90
                </span>
              </TicketPurchaseLink>
              <div className="relative mt-6 flex items-center gap-3 text-[14px] font-bold uppercase leading-none tracking-[-0.02em] text-white">
                <ShieldCheck
                  className="size-5 shrink-0 text-primary"
                  strokeWidth={1.8}
                  aria-hidden
                />
                Pagamento 100% seguro
              </div>
              <p className="relative mt-6 max-w-[242px] text-center text-[13px] font-light leading-[1.12] text-white/82">
                Vagas limitadas. Não fique de fora do maior bolão da Copa 2026!
              </p>
            </div>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-6 sm:mt-16 sm:flex sm:flex-wrap sm:justify-between sm:gap-x-6 lg:mt-20 lg:gap-x-8">
          {BAND_STATS.map(({ icon: Icon, headline, subline }) => (
            <div
              key={subline}
              className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:gap-3 sm:text-left"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-black/60 sm:size-12">
                <Icon
                  className="size-5 text-primary sm:size-6"
                  strokeWidth={1.35}
                  aria-hidden
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold tabular-nums leading-tight text-primary sm:text-base">
                  {headline}
                </p>
                <p className="text-xs font-light leading-tight text-white/90 sm:text-sm">
                  {subline}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
