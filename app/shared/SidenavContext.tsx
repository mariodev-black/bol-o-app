"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type SidenavContextValue = {
  open: boolean;
  openSidenav: () => void;
  closeSidenav: () => void;
  toggleSidenav: () => void;
};

const SidenavContext = createContext<SidenavContextValue | undefined>(undefined);

export function SidenavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openSidenav = useCallback(() => setOpen(true), []);
  const closeSidenav = useCallback(() => setOpen(false), []);
  const toggleSidenav = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(() => ({ open, openSidenav, closeSidenav, toggleSidenav }), [open, openSidenav, closeSidenav, toggleSidenav]);

  return <SidenavContext.Provider value={value}>{children}</SidenavContext.Provider>;
}

export function useSidenav() {
  const ctx = useContext(SidenavContext);
  if (!ctx) throw new Error("useSidenav precisa estar dentro de <SidenavProvider />");
  return ctx;
}

