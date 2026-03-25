"use client";

import Image from "next/image";
import bgPalpites from "@/app/assets/bg-palpites-desktop.png";

const montserrat = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";

export function TicketPurchaseBanner() {
  return (
    <section className="relative w-full overflow-hidden -mt-px">
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(165deg, #060B18 0%, #0A1628 38%, rgba(3,6,13,0.98) 72%, var(--background) 100%)",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 z-1 opacity-[0.2] mix-blend-soft-light">
        <Image
          src={bgPalpites}
          alt=""
          fill
          className="object-cover object-[center_28%]"
          sizes="100vw"
          priority
        />
      </div>
      <div
        className="absolute inset-0 z-2 opacity-[0.32]"
        style={{
          background:
            "radial-gradient(ellipse 75% 55% at 50% -5%, rgba(212,175,55,0.22), transparent 52%), radial-gradient(ellipse 55% 45% at 95% 75%, rgba(218,182,130,0.07), transparent 42%)",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 z-3 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute top-[20%] left-[10%] w-px h-8 opacity-50"
          style={{ background: "linear-gradient(180deg, transparent, #D4AF37, transparent)" }}
        />
        <div
          className="absolute top-[20%] right-[12%] w-px h-8 opacity-50"
          style={{ background: "linear-gradient(180deg, transparent, #D4AF37, transparent)" }}
        />
      </div>

      <div className="relative z-4 px-4 sm:px-6 pt-3 pb-11 sm:pb-14">
        <div className="mx-auto max-w-3xl">
          <div
            className="flex items-center justify-center gap-3 mb-5"
            style={{ fontFamily: montserrat }}
          >
            <span className="h-px w-6 sm:w-10 bg-gradient-to-r from-transparent to-[#D4AF37]/70" />
            <span
              className="text-[16px] sm:text-[20px] font-extrabold uppercase tracking-[0.38em] text-center"
              style={{ color: "rgba(218,182,130,0.92)" }}
            >
              Bolão do Milhão
            </span>
            <span className="h-px w-6 sm:w-10 bg-gradient-to-l from-transparent to-[#D4AF37]/70" />
          </div>

          <h1
            className="text-center text-[16px] sm:text-[20px] md:text-[24px] font-extrabold uppercase leading-[1.12] tracking-[0.02em] text-balance px-1"
            style={{
              fontFamily: montserrat,
              background: "linear-gradient(100deg, #C9A227 0%, #FFE8BA 38%, #E8D5A3 62%, #D4AF37 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 24px rgba(212,175,55,0.2))",
            }}
          >
            Tickets para palpitar na Copa
          </h1>

          <p
            className="mt-3 text-center text-[14px] sm:text-[15px] leading-relaxed max-w-md mx-auto"
            style={{ color: "rgba(226,213,184,0.52)" }}
          >
            Geral = palpites em toda a competição. Diário = só o dia que você escolher ao abrir os palpites. Pague com PIX.
          </p>
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 h-14 sm:h-16 z-4 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, transparent 0%, var(--background) 100%)",
        }}
        aria-hidden
      />
    </section>
  );
}
