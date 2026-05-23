"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { InstallSheetPlatform } from "@/app/shared/install-app-banner";
import { InstallAppContent } from "@/app/shared/InstallAppContent";

type InstallAppSheetProps = {
  open: boolean;
  platform: InstallSheetPlatform;
  onClose: () => void;
  onNativeInstall?: () => void | Promise<void>;
  nativeInstallAvailable?: boolean;
};

/** Sheet rápido do banner — conteúdo completo em /instalar-app */
export function InstallAppSheet({ open, onClose }: InstallAppSheetProps) {
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
          <InstallAppContent />
        </div>
      </div>
    </div>,
    document.body,
  );
}
