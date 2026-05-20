"use client";

import { createContext, useContext } from "react";
import type { AppServerConfig } from "@/lib/app-server-config";

/** Fallback só se o Provider não for montado (não lê process.env no client). */
const defaultConfig: AppServerConfig = {
  siteOrigin: "https://app.bolaodomilhao.com.br",
  appOrigin: "https://app.bolaodomilhao.com.br",
  marketingOrigin: "https://www.bolaodomilhao.com.br",
  subdomainRoutingEnabled: false,
  isMarketingRequest: false,
  extraGiftPromo: {
    enabled: false,
    championshipIds: [],
    displayName: "Bolão extra",
    prizeLabel: "R$ 10 MIL",
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
