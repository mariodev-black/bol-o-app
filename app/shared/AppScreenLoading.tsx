"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/app/lib/utils";

export type AppScreenLoadingVariant = "default" | "app-shell" | "compact";

type AppScreenLoadingProps = {
  message?: string;
  className?: string;
  /**
   * default — bloco central (ex. Suspense).
   * app-shell — altura útil sob header + nav autenticados.
   * compact — faixa menor (ex. seção na home).
   */
  variant?: AppScreenLoadingVariant;
};

/**
 * Loading full-screen / seção alinhado à paleta (preto + primary).
 */
export function AppScreenLoading({
  message = "Carregando...",
  className,
  variant = "default",
}: AppScreenLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex bg-black text-white",
        variant === "compact"
          ? "flex-row items-center justify-center gap-4 rounded-[14px] border border-white/8 bg-[#0c0c0c] px-4 py-8"
          : "flex-col items-center justify-center gap-5 py-10",
        variant === "app-shell" &&
          "min-h-[calc(100dvh-10.5rem)] w-full flex-1 px-4 sm:min-h-[calc(100dvh-9.5rem)]",
        variant === "default" && "min-h-[min(520px,70dvh)] w-full px-4",
        variant === "compact" && "min-h-0 w-full",
        className,
      )}
    >
      <Loader2
        className={cn(
          "shrink-0 animate-spin text-primary",
          variant === "compact" ? "size-8" : "size-11",
        )}
        strokeWidth={2}
        aria-hidden
      />
      <div className={cn("flex min-w-0 flex-col gap-1.5", variant === "compact" && "text-left")}>
        <span className="sr-only">{message}</span>
        <p
          className={cn(
            "font-medium leading-snug text-white/50",
            variant === "compact" ? "text-[12px]" : "max-w-xs text-center text-[13px]",
          )}
        >
          {message}
        </p>
        <p className="text-[10px] font-black uppercase tracking-[0.26em] text-primary/50">
          Bolão do Milhão
        </p>
      </div>
    </div>
  );
}
