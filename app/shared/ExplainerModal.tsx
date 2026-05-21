"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const EXIT_MS = 220;
const CARD_BG = "#111111";

export function ExplainerModal({
  open,
  onOpenChange,
  title,
  subtitle,
  titleId,
  children,
  footer,
  maxWidthClass = "max-w-[420px]",
  /** Tipografia um pouco maior — modais com muito texto (ex.: pontuação). */
  readable = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  titleId: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  readable?: boolean;
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    if (!mounted || closing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, closing]);

  const requestClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!mounted || closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, closing, requestClose]);

  if (!mounted || !portalReady) return null;

  const overlayAnim = closing
    ? "animate-ranking-steps-overlay-out"
    : "animate-ranking-steps-overlay-in";
  const panelAnim = closing
    ? "animate-ranking-steps-panel-out"
    : "animate-ranking-steps-panel-in";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/75 backdrop-blur-[6px] ${overlayAnim}`}
        aria-label="Fechar"
        onClick={requestClose}
      />

      <div
        className={`relative z-[1] flex max-h-[min(92dvh,720px)] w-full flex-col overflow-hidden rounded-t-[16px] border border-white/10 shadow-[0_20px_48px_rgba(0,0,0,0.65)] sm:max-h-[min(88dvh,680px)] sm:rounded-[16px] ${maxWidthClass} ${panelAnim}`}
        style={{ background: CARD_BG }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/8 px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className={
                readable
                  ? "text-[22px] font-black uppercase leading-tight text-white min-[380px]:text-[24px] sm:text-[26px]"
                  : "text-[20px] font-black uppercase leading-tight text-white min-[380px]:text-[22px] sm:text-[24px]"
              }
            >
              {title}
            </h2>
            {subtitle ? (
              <p
                className={
                  readable
                    ? "mt-1.5 text-[16px] font-semibold leading-snug text-white/80 min-[380px]:text-[17px]"
                    : "mt-1 text-[14px] font-semibold text-white/60 min-[380px]:text-[15px]"
                }
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/55 transition hover:text-white"
            aria-label="Fechar"
          >
            <X className="size-5" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div
          className={
            readable
              ? "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4 sm:px-6"
              : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4"
          }
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-white/8 px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
