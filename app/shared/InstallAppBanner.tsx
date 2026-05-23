"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback } from "react";
import { X } from "lucide-react";
import logoApp from "@/app/assets/logo-2.png";
import { persistInstallBannerDismissed } from "@/app/shared/install-app-banner";

type InstallAppBannerProps = {
  onDismiss: () => void;
};

export function InstallAppBanner({ onDismiss }: InstallAppBannerProps) {
  const handleDismiss = useCallback(() => {
    persistInstallBannerDismissed();
    onDismiss();
  }, [onDismiss]);

  return (
    <>
      <div
        className="border-b border-white/8 bg-[#1A1A1A]"
        role="region"
        aria-label="Instalar aplicativo"
      >
        <div className="mx-auto flex h-[52px] max-w-[1500px] items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/8 hover:text-white"
            aria-label="Fechar aviso de instalação"
          >
            <X className="size-4" strokeWidth={2.25} aria-hidden />
          </button>

          <Image
            src={logoApp}
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0 object-contain"
            aria-hidden
          />

          <p className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-white/88 sm:text-xs">
            Aposte com mais rapidez e não perca nenhum lance. Instale o app!
          </p>

          <Link
            href="/instalar-app"
            onClick={handleDismiss}
            className="shrink-0 px-1 text-[11px] font-black uppercase tracking-[0.06em] text-[#B1EB0B] transition-opacity hover:opacity-85 sm:text-xs"
          >
            Instalar
          </Link>
        </div>
      </div>
    </>
  );
}
