"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { PromoHubItemId } from "@/lib/promotions/hub-shared";

export type PromotionOpenHandler = () => void | Promise<void>;

type PromotionsHubContextValue = {
  registerPromotion: (id: PromoHubItemId, open: PromotionOpenHandler) => void;
  unregisterPromotion: (id: PromoHubItemId) => void;
  setPromotionPrefetch: (id: PromoHubItemId, data: unknown) => void;
  getPromotionPrefetch: (id: PromoHubItemId) => unknown;
  openPromotion: (id: PromoHubItemId) => boolean;
};

const PromotionsHubContext = createContext<PromotionsHubContextValue | null>(
  null,
);

export function PromotionsHubProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const handlersRef = useRef(new Map<PromoHubItemId, PromotionOpenHandler>());
  const prefetchRef = useRef<Partial<Record<PromoHubItemId, unknown>>>({});

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

  const value = useMemo(
    () => ({
      registerPromotion,
      unregisterPromotion,
      setPromotionPrefetch,
      getPromotionPrefetch,
      openPromotion,
    }),
    [
      registerPromotion,
      unregisterPromotion,
      setPromotionPrefetch,
      getPromotionPrefetch,
      openPromotion,
    ],
  );

  return (
    <PromotionsHubContext.Provider value={value}>
      {children}
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
