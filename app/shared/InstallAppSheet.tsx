"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Download,
  Ellipsis,
  EllipsisVertical,
  Plus,
  Share2,
  X,
} from "lucide-react";
import logoApp from "@/app/assets/logo-2.png";
import type { InstallSheetPlatform } from "@/app/shared/install-app-banner";
import { getInstallSiteHost } from "@/app/shared/install-app-banner";

type InstallAppSheetProps = {
  open: boolean;
  platform: InstallSheetPlatform;
  onClose: () => void;
  onNativeInstall?: () => void | Promise<void>;
  nativeInstallAvailable?: boolean;
};

function StepIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-white/14 bg-white/[0.08] align-middle text-white">
      {children}
    </span>
  );
}

function InstallStep({
  step,
  children,
}: {
  step: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#B1EB0B] text-[12px] font-black leading-none text-[#0E141B]">
        {step}
      </span>
      <p className="pt-0.5 text-[13px] font-medium leading-relaxed text-white/88">
        {children}
      </p>
    </li>
  );
}

function IosSteps() {
  return (
    <ol className="space-y-4">
      <InstallStep step={1}>
        Toque em <StepIcon><Ellipsis className="size-3.5" strokeWidth={2.5} /></StepIcon> para
        abrir o menu do Safari.
      </InstallStep>
      <InstallStep step={2}>
        Pressione <StepIcon><Share2 className="size-3.5" strokeWidth={2.25} /></StepIcon>{" "}
        <span className="text-white">Compartilhar</span> e depois{" "}
        <StepIcon><Ellipsis className="size-3.5" strokeWidth={2.5} /></StepIcon>{" "}
        <span className="text-white">Mais</span>.
      </InstallStep>
      <InstallStep step={3}>
        Selecione{" "}
        <StepIcon><Plus className="size-3.5" strokeWidth={2.5} /></StepIcon>{" "}
        <span className="text-white">Adicionar à Tela de Início</span>.
      </InstallStep>
      <InstallStep step={4}>
        Procure o ícone{" "}
        <span className="inline-flex align-middle">
          <Image
            src={logoApp}
            alt=""
            width={22}
            height={22}
            className="size-[22px] rounded-[5px] object-contain"
            aria-hidden
          />
        </span>{" "}
        na tela inicial do iPhone.
      </InstallStep>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol className="space-y-4">
      <InstallStep step={1}>
        Toque no menu do navegador{" "}
        <StepIcon><EllipsisVertical className="size-3.5" strokeWidth={2.5} /></StepIcon> no canto
        superior da tela.
      </InstallStep>
      <InstallStep step={2}>
        Selecione{" "}
        <span className="text-white">Instalar app</span> ou{" "}
        <span className="text-white">Adicionar à tela inicial</span>.
      </InstallStep>
      <InstallStep step={3}>
        Confirme em{" "}
        <StepIcon><Download className="size-3.5" strokeWidth={2.25} /></StepIcon>{" "}
        <span className="text-white">Instalar</span> ou{" "}
        <StepIcon><Check className="size-3.5" strokeWidth={2.75} /></StepIcon>{" "}
        <span className="text-white">Adicionar</span>.
      </InstallStep>
      <InstallStep step={4}>
        Procure o ícone{" "}
        <span className="inline-flex align-middle">
          <Image
            src={logoApp}
            alt=""
            width={22}
            height={22}
            className="size-[22px] rounded-[5px] object-contain"
            aria-hidden
          />
        </span>{" "}
        do Bolão do Milhão na tela inicial.
      </InstallStep>
    </ol>
  );
}

export function InstallAppSheet({
  open,
  platform,
  onClose,
  onNativeInstall,
  nativeInstallAvailable = false,
}: InstallAppSheetProps) {
  const siteHost = getInstallSiteHost();
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const handleNativeInstall = useCallback(async () => {
    if (!onNativeInstall) return;
    await onNativeInstall();
    onClose();
  }, [onClose, onNativeInstall]);

  if (!open || !portalReady) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-sheet-title"
    >
      <button
        type="button"
        className="animate-perfil-avatar-overlay-in absolute inset-0 z-0 bg-black/80 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="animate-perfil-avatar-sheet-in relative z-10 flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#101010] shadow-[0_-12px_48px_rgba(0,0,0,0.55)] sm:max-h-[88vh] sm:rounded-2xl sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <h2
            id="install-app-sheet-title"
            className="font-helvetica-now-display text-left text-[15px] font-black uppercase tracking-wide text-white"
          >
            Instalar aplicativo
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white transition-colors hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="size-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div
            className="mb-5 flex items-center gap-3 rounded-xl border px-3.5 py-3"
            style={{
              borderColor: "rgba(177,235,11,0.35)",
              background: "rgba(177,235,11,0.06)",
            }}
          >
            <Image
              src={logoApp}
              alt=""
              width={44}
              height={44}
              className="size-11 shrink-0 rounded-[10px] object-contain"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-white">
                Bolão do Milhão
              </p>
              <p className="truncate text-[12px] font-medium text-white/50">
                {siteHost}
              </p>
            </div>
          </div>

          {platform === "ios" ? <IosSteps /> : <AndroidSteps />}

          {nativeInstallAvailable && platform === "android" ? (
            <button
              type="button"
              onClick={() => void handleNativeInstall()}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-xl text-[12px] font-black uppercase tracking-wide text-[#0E141B] transition-transform active:scale-[0.98]"
              style={{
                background: "#B1EB0B",
                boxShadow: "0 0 16px rgba(177,235,11,0.22)",
              }}
            >
              Instalar agora
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
