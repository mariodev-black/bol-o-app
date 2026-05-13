"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type BolaoToastVariant = "error" | "success" | "info";

type ToastItem = { id: number; variant: BolaoToastVariant; message: string };

type ToastApi = {
  show: (variant: BolaoToastVariant, message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
};

const BolaoToastContext = createContext<ToastApi | null>(null);

const DEDupe_MS = 2800;

/** Tempo da animação de saída (deve bater com `globals.css` — bolao-toast-slide-out) */
const EXIT_ANIM_MS = 480;
/** Tempo até começar a sair (alinha ao comportamento anterior ~5,2s até sumir) */
const AUTO_DISMISS_MS = 5200;

export function BolaoToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dedupeRef = useRef<{ key: string; at: number } | null>(null);

  const pushToast = useCallback((variant: BolaoToastVariant, message: string, dedupeKey?: string) => {
    const key = dedupeKey ?? `${variant}:${message}`;
    const now = Date.now();
    if (dedupeRef.current?.key === key && now - dedupeRef.current.at < DEDupe_MS) {
      return;
    }
    dedupeRef.current = { key, at: now };

    const id = now + Math.random();
    setToasts((t) => [...t, { id, variant, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show: pushToast,
      error: (message: string) => pushToast("error", message),
      success: (message: string) => pushToast("success", message),
      info: (message: string) => pushToast("info", message),
    }),
    [pushToast]
  );

  return (
    <BolaoToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed top-0 right-0 z-200 flex max-h-[min(70vh,calc(100vh-32px))] flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:right-6 sm:top-6 sm:px-6 sm:pb-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))]"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <BolaoToastCard
            key={t.id}
            variant={t.variant}
            message={t.message}
            onRemove={() => removeToast(t.id)}
          />
        ))}
      </div>
    </BolaoToastContext.Provider>
  );
}

export function useBolaoToast(): ToastApi {
  const ctx = useContext(BolaoToastContext);
  if (!ctx) {
    throw new Error("useBolaoToast must be used within BolaoToastProvider");
  }
  return ctx;
}

function BolaoToastCard({
  variant,
  message,
  onRemove,
}: {
  variant: BolaoToastVariant;
  message: string;
  onRemove: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const removedRef = useRef(false);

  const beginLeave = useCallback(() => {
    setLeaving((was) => {
      if (was) return was;
      return true;
    });
  }, []);

  useEffect(() => {
    const delay = Math.max(320, AUTO_DISMISS_MS - EXIT_ANIM_MS);
    const t = window.setTimeout(beginLeave, delay);
    return () => window.clearTimeout(t);
  }, [beginLeave]);

  useEffect(() => {
    if (!leaving) return;

    const el = rootRef.current;
    const finish = () => {
      if (removedRef.current) return;
      removedRef.current = true;
      onRemove();
    };

    if (!el) {
      finish();
      return;
    }

    const onAnimationEnd = (e: AnimationEvent) => {
      if (e.target !== el) return;
      finish();
    };

    el.addEventListener("animationend", onAnimationEnd);
    const fallback = window.setTimeout(finish, EXIT_ANIM_MS + 120);

    return () => {
      el.removeEventListener("animationend", onAnimationEnd);
      window.clearTimeout(fallback);
    };
  }, [leaving, onRemove]);

  const border =
    variant === "error"
      ? "border-red-400/35 shadow-[0_0_28px_rgba(239,68,68,0.12)]"
      : variant === "success"
        ? "border-primary/45 shadow-[0_0_28px_rgba(177,235,11,0.14)]"
        : "border-primary/28 shadow-[0_0_24px_rgba(177,235,11,0.08)]";

  const iconBg =
    variant === "error"
      ? "bg-red-500/15 text-red-300"
      : variant === "success"
        ? "bg-primary/18 text-primary"
        : "bg-primary/12 text-[#D7FF59]";

  const Icon = variant === "error" ? AlertCircle : variant === "success" ? CheckCircle2 : Info;

  return (
    <div
      ref={rootRef}
      className={`bolao-toast-card pointer-events-auto mx-0 flex w-full max-w-[min(420px,calc(100vw-32px))] rounded-[14px] border bg-[#08090C]/95 px-3.5 py-3.5 backdrop-blur-md sm:px-4 ${border} ${leaving ? "bolao-toast-card--leaving" : ""}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${iconBg}`}>
          <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="font-helvetica-now-display text-[12px] font-black uppercase tracking-[0.2em] text-primary/90">
            Bolão do Milhão
          </p>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-white/92">{message}</p>
        </div>
        <button
          type="button"
          onClick={beginLeave}
          className="shrink-0 rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/8 hover:text-white/70"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
