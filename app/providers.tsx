"use client";

import React, { Suspense } from "react";
import { BolaoToastProvider } from "@/app/components/BolaoToast";
import { AuthProvider } from "@/app/shared/AuthContext";
import { AppServerConfigProvider } from "@/app/shared/AppServerConfigContext";
import { BrasilMarrocosPlacarPromoHost } from "@/app/shared/BrasilMarrocosPlacarPromoHost";
import { ExtraGiftPromoHost } from "@/app/shared/ExtraGiftPromoHost";
import { PromotionsHubProvider } from "@/app/shared/PromotionsHubContext";
import { HomeAuthModalProvider } from "@/app/shared/HomeAuthModalContext";
import { HomeAuthModalHost } from "@/app/shared/HomeAuthModalHost";
import { ChampionsPlacarPromoHost } from "@/app/shared/ChampionsPlacarPromoHost";
import { MainBolaoPromoModalHost } from "@/app/shared/MainBolaoPromoModalHost";
import { ProfileCompletionHost } from "@/app/shared/ProfileCompletionHost";
import { PwaManager } from "@/app/shared/PwaManager";
import { AppErrorBoundary } from "@/app/shared/AppErrorBoundary";
import { ChunkLoadRecovery } from "@/app/shared/ChunkLoadRecovery";
import { ReferralCapture } from "@/app/shared/ReferralCapture";
import { PromotionsHubDeepLink } from "@/app/shared/PromotionsHubDeepLink";
import { SkaleFunnelLockHost } from "@/app/shared/SkaleFunnelLockHost";
import { SidenavProvider } from "@/app/shared/SidenavContext";
import type { AuthUser } from "@/lib/auth/auth-user";
import type { AppServerConfig } from "@/lib/app-server-config";

export function Providers({
  children,
  appServerConfig,
  initialAuthUser = null,
  errorBoundaryChrome = false,
}: {
  children: React.ReactNode;
  appServerConfig: AppServerConfig;
  initialAuthUser?: AuthUser | null;
  /** Header + nav no fallback de erro (rotas autenticadas). */
  errorBoundaryChrome?: boolean;
}) {
  return (
    <BolaoToastProvider>
      <AppServerConfigProvider value={appServerConfig}>
      <AuthProvider initialUser={initialAuthUser}>
        <ChunkLoadRecovery />
        <PwaManager />
        <ProfileCompletionHost>
          <PromotionsHubProvider>
          <HomeAuthModalProvider>
          <MainBolaoPromoModalHost>
          <ExtraGiftPromoHost>
          <BrasilMarrocosPlacarPromoHost>
            <ChampionsPlacarPromoHost>
              <HomeAuthModalHost />
              <Suspense fallback={null}>
                <ReferralCapture />
                <PromotionsHubDeepLink />
                <SkaleFunnelLockHost />
              </Suspense>
              <AppErrorBoundary showAppChrome={errorBoundaryChrome}>
                <SidenavProvider>{children}</SidenavProvider>
              </AppErrorBoundary>
            </ChampionsPlacarPromoHost>
          </BrasilMarrocosPlacarPromoHost>
          </ExtraGiftPromoHost>
          </MainBolaoPromoModalHost>
          </HomeAuthModalProvider>
          </PromotionsHubProvider>
        </ProfileCompletionHost>
      </AuthProvider>
      </AppServerConfigProvider>
    </BolaoToastProvider>
  );
}
