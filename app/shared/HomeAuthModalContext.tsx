"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type HomeAuthTab = "login" | "cadastro";

type HomeAuthModalContextValue = {
  open: boolean;
  tab: HomeAuthTab;
  fromPath: string | null;
  openLogin: (fromPath?: string | null) => void;
  openCadastro: (fromPath?: string | null) => void;
  close: () => void;
  setTab: (tab: HomeAuthTab) => void;
};

const HomeAuthModalContext = createContext<HomeAuthModalContextValue | undefined>(
  undefined,
);

export function HomeAuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<HomeAuthTab>("cadastro");
  const [fromPath, setFromPath] = useState<string | null>("/");

  const openLogin = useCallback((from?: string | null) => {
    setTab("login");
    setFromPath(from ?? "/");
    setOpen(true);
  }, []);

  const openCadastro = useCallback((from?: string | null) => {
    setTab("cadastro");
    setFromPath(from ?? "/");
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo<HomeAuthModalContextValue>(
    () => ({
      open,
      tab,
      fromPath,
      openLogin,
      openCadastro,
      close,
      setTab,
    }),
    [open, tab, fromPath, openLogin, openCadastro, close],
  );

  return (
    <HomeAuthModalContext.Provider value={value}>
      {children}
    </HomeAuthModalContext.Provider>
  );
}

export function useHomeAuthModal(): HomeAuthModalContextValue {
  const ctx = useContext(HomeAuthModalContext);
  if (!ctx) {
    throw new Error("useHomeAuthModal must be used within HomeAuthModalProvider");
  }
  return ctx;
}
