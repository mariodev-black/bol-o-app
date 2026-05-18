"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import logoApp from "@/app/assets/logo-2.png";
import { InstallAppSheet } from "@/app/shared/InstallAppSheet";
import {
  detectInstallSheetPlatform,
  persistInstallBannerDismissed,
  type InstallSheetPlatform,
} from "@/app/shared/install-app-banner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallAppBannerProps = {
  onDismiss: () => void;
};

export function InstallAppBanner({ onDismiss }: InstallAppBannerProps) {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetPlatform, setSheetPlatform] =
    useState<InstallSheetPlatform>("android");
  const [nativeInstallAvailable, setNativeInstallAvailable] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setNativeInstallAvailable(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    persistInstallBannerDismissed();
    onDismiss();
  }, [onDismiss]);

  const handleNativeInstall = useCallback(async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    deferredPromptRef.current = null;
    setNativeInstallAvailable(false);
  }, []);

  const handleInstall = useCallback(() => {
    setSheetPlatform(detectInstallSheetPlatform());
    setSheetOpen(true);
  }, []);

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

          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 px-1 text-[11px] font-black uppercase tracking-[0.06em] text-[#B1EB0B] transition-opacity hover:opacity-85 sm:text-xs"
          >
            Instalar
          </button>
        </div>
      </div>

      <InstallAppSheet
        open={sheetOpen}
        platform={sheetPlatform}
        onClose={() => setSheetOpen(false)}
        onNativeInstall={handleNativeInstall}
        nativeInstallAvailable={nativeInstallAvailable}
      />
    </>
  );
}
