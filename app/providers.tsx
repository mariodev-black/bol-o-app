"use client";

import React, { Suspense } from "react";
import { BolaoToastProvider } from "@/app/components/BolaoToast";
import { AuthProvider } from "@/app/shared/AuthContext";
import { AppServerConfigProvider } from "@/app/shared/AppServerConfigContext";
import { BrasilPanamaPlacarPromoHost } from "@/app/shared/BrasilPanamaPlacarPromoHost";
import { ChampionsPlacarPromoHost } from "@/app/shared/ChampionsPlacarPromoHost";
import { ExtraGiftPromoHost } from "@/app/shared/ExtraGiftPromoHost";
import { MainBolaoPromoModalHost } from "@/app/shared/MainBolaoPromoModalHost";
import { ProfileCompletionHost } from "@/app/shared/ProfileCompletionHost";
import { PwaManager } from "@/app/shared/PwaManager";
import { ReferralCapture } from "@/app/shared/ReferralCapture";
import { SidenavProvider } from "@/app/shared/SidenavContext";
import type { AuthUser } from "@/lib/auth/auth-user";
import type { AppServerConfig } from "@/lib/app-server-config";

export function Providers({
  children,
  appServerConfig,
  initialAuthUser = null,
}: {
  children: React.ReactNode;
  appServerConfig: AppServerConfig;
  initialAuthUser?: AuthUser | null;
}) {
  return (
    <BolaoToastProvider>
      <AppServerConfigProvider value={appServerConfig}>
      <AuthProvider initialUser={initialAuthUser}>
        <PwaManager />
        <ProfileCompletionHost>
          <BrasilPanamaPlacarPromoHost>
            <ChampionsPlacarPromoHost>
              <ExtraGiftPromoHost>
                <MainBolaoPromoModalHost>
                  <Suspense fallback={null}>
                    <ReferralCapture />
                  </Suspense>
                  <SidenavProvider>{children}</SidenavProvider>
                </MainBolaoPromoModalHost>
              </ExtraGiftPromoHost>
            </ChampionsPlacarPromoHost>
          </BrasilPanamaPlacarPromoHost>
        </ProfileCompletionHost>
      </AuthProvider>
      </AppServerConfigProvider>
    </BolaoToastProvider>
  );
}

