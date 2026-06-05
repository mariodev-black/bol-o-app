"use client";

import { Suspense, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CadastrarContent } from "@/app/(auth)/_components/CadastrarContent";
import { LoginContent } from "@/app/(auth)/_components/LoginContent";
import { AuthScreenLayout } from "@/app/(auth)/_components/AuthScreenLayout";
import { useHomeAuthModal } from "@/app/shared/HomeAuthModalContext";

const AUTH_MODAL_Z = 160;

function HomeAuthModalInner() {
  const { open, tab, fromPath, close, setTab } = useHomeAuthModal();
  const prevTabRef = useRef(tab);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    prevTabRef.current = tab;
  }, [tab]);

  if (!open) return null;

  const panelDirection =
    prevTabRef.current === tab
      ? "right"
      : tab === "login"
        ? "right"
        : "left";

  return createPortal(
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center overflow-hidden bg-black/85 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      style={{ zIndex: AUTH_MODAL_Z }}
      role="dialog"
      aria-modal="true"
      aria-label={tab === "login" ? "Entrar na conta" : "Criar conta"}
      onClick={close}
    >
      <div
        className="relative flex w-full max-w-lg max-h-[min(92dvh,820px)] flex-col overflow-hidden sm:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black sm:right-4 sm:top-4"
        >
          <X className="size-4" strokeWidth={2.5} />
        </button>

        <AuthScreenLayout
          mode="modal"
          activeTab={tab}
          onTabChange={setTab}
          panelDirection={panelDirection}
        >
          {tab === "login" ? (
            <LoginContent embedded fromPath={fromPath} onAuthSuccess={close} />
          ) : (
            <CadastrarContent embedded fromPath={fromPath} onAuthSuccess={close} />
          )}
        </AuthScreenLayout>
      </div>
    </div>,
    document.body,
  );
}

export function HomeAuthModalHost() {
  return (
    <Suspense fallback={null}>
      <HomeAuthModalInner />
    </Suspense>
  );
}
