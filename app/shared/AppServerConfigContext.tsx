"use client";

import { createContext, useContext } from "react";
import type { AppServerConfig } from "@/lib/app-server-config";

/** Fallback só se o Provider não for montado (não lê process.env no client). */
const defaultConfig: AppServerConfig = {
  siteOrigin: "https://bolaodomilhao.com.br",
  copaBonusPromo: {
    enabled: false,
    championshipId: null,
    bonusExtraDisplayName: "Bolão extra",
    principalProductLabel: "Bolão do Milhão 2026",
    bonusShortLabel: "Brasileirão",
  },
  extraChampionshipIds: [],
};

const AppServerConfigContext = createContext<AppServerConfig>(defaultConfig);

export function AppServerConfigProvider({
  value,
  children,
}: {
  value: AppServerConfig;
  children: React.ReactNode;
}) {
  return (
    <AppServerConfigContext.Provider value={value}>{children}</AppServerConfigContext.Provider>
  );
}

export function useAppServerConfig(): AppServerConfig {
  return useContext(AppServerConfigContext);
}
