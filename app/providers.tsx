"use client";

import React from "react";
import { BolaoToastProvider } from "@/app/components/BolaoToast";
import { AuthProvider } from "@/app/shared/AuthContext";
import { ProfileCompletionHost } from "@/app/shared/ProfileCompletionHost";
import { SidenavProvider } from "@/app/shared/SidenavContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BolaoToastProvider>
      <AuthProvider>
        <ProfileCompletionHost>
          <SidenavProvider>{children}</SidenavProvider>
        </ProfileCompletionHost>
      </AuthProvider>
    </BolaoToastProvider>
  );
}

