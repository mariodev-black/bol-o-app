"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import logo from "@/app/assets/logo.svg";
import { Header } from "@/app/shared/Header";
import { NavBottom } from "@/app/shared/NavBottom";

type RouteErrorPageProps = {
  reset?: () => void;
  digest?: string;
  title?: string;
  message?: string;
  /** Mostra header + nav inferior (rotas autenticadas). */
  showAppChrome?: boolean;
  /** Versão mínima para global-error (sem providers). */
  minimal?: boolean;
};

export function RouteErrorPage({
  reset,
  digest,
  title = "Não foi possível carregar a página",
  message = "Algo deu errado ao abrir esta tela. Tente recarregar ou volte para continuar palpitando.",
  showAppChrome = false,
  minimal = false,
}: RouteErrorPageProps) {
  useEffect(() => {
    if (digest) {
      console.error("[route-error]", digest);
    }
  }, [digest]);

  const content = (
    <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
      {!minimal ? (
        <Image
          src={logo}
          alt="Bolão do Milhão"
          width={160}
          height={48}
          className="h-auto w-[min(160px,42vw)] opacity-90"
          priority
        />
      ) : null}

      <div
        className={`flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] ${minimal ? "" : "mt-8"}`}
        aria-hidden
      >
        <AlertTriangle className="size-7 text-primary" strokeWidth={2} />
      </div>

      <h1
        className="mt-5 text-[clamp(1.25rem,4.5vw,1.65rem)] font-black uppercase leading-tight tracking-tight text-white"
        style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
      >
        {title}
      </h1>

      <p className="mt-3 max-w-[360px] text-[15px] font-medium leading-snug text-white/55">
        {message}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {reset ? (
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[50px] min-w-[140px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-[13px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
          >
            <RefreshCw className="size-4" strokeWidth={2.5} aria-hidden />
            Recarregar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-[50px] min-w-[140px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-[13px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
          >
            <RefreshCw className="size-4" strokeWidth={2.5} aria-hidden />
            Recarregar
          </button>
        )}
        <Link
          href="/boloes"
          className="inline-flex min-h-[50px] min-w-[140px] items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-6 text-[13px] font-black uppercase tracking-wide text-white transition hover:border-white/35 active:scale-[0.98]"
        >
          <ArrowLeft className="size-4" strokeWidth={2.5} aria-hidden />
          Voltar
        </Link>
      </div>

      {digest ? (
        <p className="mt-8 text-[11px] font-medium text-white/30">
          Código{" "}
          <span className="font-mono tabular-nums text-white/45">{digest.slice(0, 12)}</span>
        </p>
      ) : null}
    </div>
  );

  if (minimal) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-12">
        {content}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black">
      {showAppChrome ? <Header /> : null}

      <main
        className={[
          "relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4",
          showAppChrome
            ? "pb-32 pt-[var(--app-header-height,55px)] md:pb-8 lg:pt-[var(--app-header-height,80px)]"
            : "py-12",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute left-1/2 top-[18%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        </div>
        {content}
      </main>

      {showAppChrome ? (
        <Suspense fallback={null}>
          <NavBottom />
        </Suspense>
      ) : null}
    </div>
  );
}
