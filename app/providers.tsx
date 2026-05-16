"use client";

import React, { Suspense } from "react";
import { BolaoToastProvider } from "@/app/components/BolaoToast";
import { AuthProvider } from "@/app/shared/AuthContext";
import { ProfileCompletionHost } from "@/app/shared/ProfileCompletionHost";
import { ReferralCapture } from "@/app/shared/ReferralCapture";
import { SidenavProvider } from "@/app/shared/SidenavContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BolaoToastProvider>
      <AuthProvider>
        <ProfileCompletionHost>
          <Suspense fallback={null}>
            <ReferralCapture />
          </Suspense>
          <SidenavProvider>{children}</SidenavProvider>
        </ProfileCompletionHost>
      </AuthProvider>
    </BolaoToastProvider>
  );
}

