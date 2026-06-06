"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { ArrowRight, Home } from "lucide-react";
import logo from "@/app/assets/logo.svg";
import { Header } from "@/app/shared/Header";
import { NavBottom } from "@/app/shared/NavBottom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black">
      <Header />

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-32 pt-[var(--app-header-height,55px)] md:pb-8 lg:pt-[var(--app-header-height,80px)]">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          <div className="absolute left-1/2 top-[18%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[8%] right-[-10%] h-[280px] w-[280px] rounded-full bg-primary/6 blur-[100px]" />
        </div>

        <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
          <Image
            src={logo}
            alt="Bolão do Milhão"
            width={160}
            height={48}
            className="h-auto w-[min(160px,42vw)] opacity-90"
            priority
          />

          <p
            className="mt-8 font-black uppercase leading-none tracking-tight text-primary"
            style={{
              fontFamily: "var(--font-montserrat), sans-serif",
              fontSize: "clamp(5.5rem, 22vw, 9rem)",
              textShadow: "0 0 40px rgba(177, 235, 11, 0.35)",
            }}
          >
            404
          </p>

          <h1
            className="mt-4 text-[clamp(1.35rem,4.5vw,1.75rem)] font-black uppercase leading-tight tracking-tight text-white"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            Página fora do bolão
          </h1>

          <p className="mt-3 max-w-[340px] text-[15px] font-medium leading-snug text-white/55">
            Esse endereço não existe ou foi movido. Volte para a home e continue
            palpitando nos jogos.
          </p>

          <div className="not-found-cta-orbit mt-10">
            <Link
              href="/"
              className="not-found-cta-inner group inline-flex min-h-[54px] min-w-[240px] items-center justify-center gap-2 rounded-full bg-primary px-8 text-[14px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
            >
              <Home
                className="size-5 transition-transform duration-500 group-hover:-translate-y-0.5"
                strokeWidth={2.5}
                aria-hidden
              />
              Voltar para a home
              <ArrowRight
                className="size-5 transition-transform duration-300 group-hover:translate-x-0.5"
                strokeWidth={2.5}
                aria-hidden
              />
            </Link>
          </div>

          <p className="mt-8 text-[12px] font-medium text-white/35">
            Código{" "}
            <span className="font-mono tabular-nums text-white/50">404</span>
            {" · "}
            Rota não encontrada
          </p>
        </div>
      </main>

      <Suspense fallback={null}>
        <NavBottom />
      </Suspense>
    </div>
  );
}
