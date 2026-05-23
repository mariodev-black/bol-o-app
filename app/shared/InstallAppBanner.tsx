"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import logoApp from "@/app/assets/logo-2.png";
import {
  detectInstallSheetPlatform,
  persistInstallBannerDismissed,
} from "@/app/shared/install-app-banner";
import { dispatchPwaInstalled } from "@/lib/push/push-prompt";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallAppBannerProps = {
  onDismiss: () => void;
};

export function InstallAppBanner({ onDismiss }: InstallAppBannerProps) {
  const router = useRouter();
  const platform = detectInstallSheetPlatform();
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [nativeInstallAvailable, setNativeInstallAvailable] = useState(false);
  const [installing, setInstalling] = useState(false);

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

  const handleInstall = useCallback(async () => {
    const promptEvent = deferredPromptRef.current;

    if (platform === "android" && promptEvent) {
      setInstalling(true);
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        deferredPromptRef.current = null;
        setNativeInstallAvailable(false);
        if (outcome === "accepted") {
          dispatchPwaInstalled();
          handleDismiss();
        }
      } catch {
        router.push("/instalar-app");
      } finally {
        setInstalling(false);
      }
      return;
    }

    router.push("/instalar-app");
  }, [platform, router, handleDismiss]);

  const showNativeAndroidCta = platform === "android" && nativeInstallAvailable;

  return (
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
          {showNativeAndroidCta
            ? "Instale o app na tela inicial e receba avisos importantes."
            : "Aposte com mais rapidez e não perca nenhum lance. Instale o app!"}
        </p>

        {showNativeAndroidCta ? (
          <button
            type="button"
            disabled={installing}
            onClick={() => void handleInstall()}
            className="shrink-0 rounded-lg bg-[#B1EB0B] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#0E141B] transition-opacity hover:opacity-90 disabled:opacity-60 sm:text-[11px]"
          >
            {installing ? "..." : "Instalar"}
          </button>
        ) : (
          <Link
            href="/instalar-app"
            onClick={handleDismiss}
            className="shrink-0 px-1 text-[11px] font-black uppercase tracking-[0.06em] text-[#B1EB0B] transition-opacity hover:opacity-85 sm:text-xs"
          >
            Instalar
          </Link>
        )}
      </div>
    </div>
  );
}
