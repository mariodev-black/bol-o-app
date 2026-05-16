"use client";

import React, { Suspense } from "react";
import { BolaoToastProvider } from "@/app/components/BolaoToast";
import { AuthProvider } from "@/app/shared/AuthContext";
import { AppServerConfigProvider } from "@/app/shared/AppServerConfigContext";
import { CopaBonusPromoHost } from "@/app/shared/CopaBonusPromoHost";
import { ProfileCompletionHost } from "@/app/shared/ProfileCompletionHost";
import { ReferralCapture } from "@/app/shared/ReferralCapture";
import { SidenavProvider } from "@/app/shared/SidenavContext";
import type { AppServerConfig } from "@/lib/app-server-config";

export function Providers({
  children,
  appServerConfig,
}: {
  children: React.ReactNode;
  appServerConfig: AppServerConfig;
}) {
  return (
    <BolaoToastProvider>
      <AppServerConfigProvider value={appServerConfig}>
      <AuthProvider>
        <ProfileCompletionHost>
          <CopaBonusPromoHost>
            <Suspense fallback={null}>
              <ReferralCapture />
            </Suspense>
            <SidenavProvider>{children}</SidenavProvider>
          </CopaBonusPromoHost>
        </ProfileCompletionHost>
      </AuthProvider>
      </AppServerConfigProvider>
    </BolaoToastProvider>
  );
}

