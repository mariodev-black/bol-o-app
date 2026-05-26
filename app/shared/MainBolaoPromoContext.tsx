"use client";

import { createContext, useContext } from "react";

export type MainBolaoPromoRequestOptions = {
  /** Navegação imediata; o modal abre ~1s depois na página de destino. */
  navigate?: () => void;
};

export type MainBolaoPromoContextValue = {
  /** Abre o modal promocional do bolão principal, se elegível. */
  requestModal: (options?: MainBolaoPromoRequestOptions) => void;
};

const MainBolaoPromoContext = createContext<MainBolaoPromoContextValue | null>(
  null,
);

export function MainBolaoPromoProvider({
  value,
  children,
}: {
  value: MainBolaoPromoContextValue;
  children: React.ReactNode;
}) {
  return (
    <MainBolaoPromoContext.Provider value={value}>
      {children}
    </MainBolaoPromoContext.Provider>
  );
}

/** Bolão extra grátis (brinde `is_promo_bonus`). */
export function isGratisBolaoExtraTicket(
  bolaoType: string | undefined,
  isPromoBonus?: boolean,
): boolean {
  return bolaoType === "extra" && isPromoBonus === true;
}

export function useMainBolaoPromoModal(): MainBolaoPromoContextValue {
  const ctx = useContext(MainBolaoPromoContext);
  if (!ctx) {
    return {
      requestModal: (options) => {
        options?.navigate?.();
      },
    };
  }
  return ctx;
}
