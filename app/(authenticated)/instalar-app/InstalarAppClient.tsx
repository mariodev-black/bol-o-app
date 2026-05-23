"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InstallAppContent } from "@/app/shared/InstallAppContent";

export function InstalarAppClient() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/perfil"
        className="mb-6 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-white/45 transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" strokeWidth={2.25} />
        Voltar
      </Link>

      <header className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
          Aplicativo
        </p>
        <h1 className="mt-2 font-helvetica-now-display text-[26px] font-black uppercase leading-tight tracking-wide text-white sm:text-[30px]">
          Baixar o app
        </h1>
        <p className="mt-3 text-[14px] font-medium leading-relaxed text-white/50">
          Instale o PWA no seu celular para abrir mais rápido, ter ícone na tela inicial e
          receber avisos importantes.
        </p>
      </header>

      <div className="rounded-[18px] border border-white/8 bg-[#101010] p-5 sm:p-6">
        <InstallAppContent />
      </div>
    </div>
  );
}
