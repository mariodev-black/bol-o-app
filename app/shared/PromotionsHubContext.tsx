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
import { useBolaoToast } from "@/app/components/BolaoToast";
import { PromotionsBottomSheet } from "@/app/shared/PromotionsBottomSheet";
import { useAuth } from "@/app/shared/AuthContext";
import type {
  PromoHubItem,
  PromoHubItemId,
  PromoHubResponse,
} from "@/lib/promotions/hub-shared";

export type PromotionOpenHandler = () => void | Promise<void>;

/** Evita rajadas no client; o servidor já cacheia por ~3s. */
const HUB_CLIENT_STALE_MS = 45_000;

type PromotionsHubContextValue = {
  registerPromotion: (id: PromoHubItemId, open: PromotionOpenHandler) => void;
  unregisterPromotion: (id: PromoHubItemId) => void;
  setPromotionPrefetch: (id: PromoHubItemId, data: unknown) => void;
  getPromotionPrefetch: (id: PromoHubItemId) => unknown;
  openPromotion: (id: PromoHubItemId) => boolean;
  highlightCount: number;
  openPromotionsSheet: () => void;
  invalidatePromotionsHub: () => void;
};

const PromotionsHubContext = createContext<PromotionsHubContextValue | null>(
  null,
);

function PromotionsHubSheetHost({
  open,
  onClose,
  loading,
  error,
  data,
  onActivate,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: PromoHubResponse | null;
  onActivate: (item: PromoHubItem) => void;
}) {
  if (!open) return null;
  return (
    <PromotionsBottomSheet
      open={open}
      onClose={onClose}
      loading={loading}
      error={error}
      data={data}
      onActivate={onActivate}
    />
  );
}

export function PromotionsHubProvider({ children }: { children: ReactNode }) {
  const toast = useBolaoToast();
  const { ready, isLoggedIn } = useAuth();
  const handlersRef = useRef(new Map<PromoHubItemId, PromotionOpenHandler>());
  const prefetchRef = useRef<Partial<Record<PromoHubItemId, unknown>>>({});
  const fetchedAtRef = useRef(0);
  const fetchGenRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const prefetchedRef = useRef(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [hubData, setHubData] = useState<PromoHubResponse | null>(null);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [highlightCount, setHighlightCount] = useState(0);

  const registerPromotion = useCallback(
    (id: PromoHubItemId, open: PromotionOpenHandler) => {
      handlersRef.current.set(id, open);
    },
    [],
  );

  const unregisterPromotion = useCallback((id: PromoHubItemId) => {
    handlersRef.current.delete(id);
  }, []);

  const setPromotionPrefetch = useCallback(
    (id: PromoHubItemId, data: unknown) => {
      prefetchRef.current[id] = data;
    },
    [],
  );

  const getPromotionPrefetch = useCallback((id: PromoHubItemId) => {
    return prefetchRef.current[id];
  }, []);

  const openPromotion = useCallback((id: PromoHubItemId) => {
    const handler = handlersRef.current.get(id);
    if (!handler) return false;
    void Promise.resolve(handler()).catch(() => {});
    return true;
  }, []);

  const fetchHub = useCallback(
    async (opts?: { force?: boolean; silent?: boolean }) => {
      if (!isLoggedIn) return;

      const now = Date.now();
      if (
        !opts?.force &&
        fetchedAtRef.current > 0 &&
        now - fetchedAtRef.current < HUB_CLIENT_STALE_MS
      ) {
        return;
      }

      if (inFlightRef.current) {
        await inFlightRef.current;
        return;
      }

      const gen = ++fetchGenRef.current;
      const run = async () => {
        if (!opts?.silent) {
          setHubLoading(true);
          setHubError(null);
        }
        try {
          const r = await fetch("/api/promotions/hub", {
            credentials: "include",
            cache: "no-store",
          });
          const json = (await r.json().catch(() => ({}))) as PromoHubResponse & {
            error?: string;
          };
          if (gen !== fetchGenRef.current) return;
          if (!r.ok) {
            throw new Error(json.error ?? "Falha ao carregar");
          }
          setHubData(json);
          setHighlightCount(json.highlightCount ?? 0);
          fetchedAtRef.current = Date.now();
        } catch (e) {
          if (gen !== fetchGenRef.current) return;
          if (!opts?.silent) {
            setHubError(e instanceof Error ? e.message : "Erro ao carregar");
            setHubData(null);
            setHighlightCount(0);
          }
        } finally {
          if (gen === fetchGenRef.current && !opts?.silent) {
            setHubLoading(false);
          }
        }
      };

      inFlightRef.current = run();
      try {
        await inFlightRef.current;
      } finally {
        inFlightRef.current = null;
      }
    },
    [isLoggedIn],
  );

  const invalidatePromotionsHub = useCallback(() => {
    fetchedAtRef.current = 0;
    void fetchHub({ force: true, silent: true });
  }, [fetchHub]);

  const openPromotionsSheet = useCallback(() => {
    setSheetOpen(true);
    void fetchHub({ silent: fetchedAtRef.current > 0 });
  }, [fetchHub]);

  const closePromotionsSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const handleActivate = useCallback(
    (item: PromoHubItem) => {
      if (!item.actionable) return;
      setSheetOpen(false);
      const ok = openPromotion(item.id);
      if (!ok) {
        toast.error("Não foi possível abrir esta promoção agora.");
      }
    },
    [openPromotion, toast],
  );

  useEffect(() => {
    if (!ready || !isLoggedIn) {
      prefetchedRef.current = false;
      fetchedAtRef.current = 0;
      setHubData(null);
      setHighlightCount(0);
      setSheetOpen(false);
      return;
    }
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;

    const timeoutId = window.setTimeout(() => {
      void fetchHub({ silent: true });
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ready, isLoggedIn, fetchHub, setPromotionPrefetch]);

  const value = useMemo(
    () => ({
      registerPromotion,
      unregisterPromotion,
      setPromotionPrefetch,
      getPromotionPrefetch,
      openPromotion,
      highlightCount,
      openPromotionsSheet,
      invalidatePromotionsHub,
    }),
    [
      registerPromotion,
      unregisterPromotion,
      setPromotionPrefetch,
      getPromotionPrefetch,
      openPromotion,
      highlightCount,
      openPromotionsSheet,
      invalidatePromotionsHub,
    ],
  );

  return (
    <PromotionsHubContext.Provider value={value}>
      {children}
      {isLoggedIn ? (
        <PromotionsHubSheetHost
          open={sheetOpen}
          onClose={closePromotionsSheet}
          loading={hubLoading}
          error={hubError}
          data={hubData}
          onActivate={handleActivate}
        />
      ) : null}
    </PromotionsHubContext.Provider>
  );
}

export function usePromotionsHub(): PromotionsHubContextValue {
  const ctx = useContext(PromotionsHubContext);
  if (!ctx) {
    return {
      registerPromotion: () => {},
      unregisterPromotion: () => {},
      setPromotionPrefetch: () => {},
      getPromotionPrefetch: () => undefined,
      openPromotion: () => false,
      highlightCount: 0,
      openPromotionsSheet: () => {},
      invalidatePromotionsHub: () => {},
    };
  }
  return ctx;
}

/** Registra o modal da promoção para abrir pelo ícone de presente no header. */
export function useRegisterPromotionHub(
  id: PromoHubItemId,
  open: PromotionOpenHandler,
) {
  const { registerPromotion, unregisterPromotion } = usePromotionsHub();

  useEffect(() => {
    registerPromotion(id, open);
    return () => unregisterPromotion(id);
  }, [id, open, registerPromotion, unregisterPromotion]);
}
