"use client";

import React from "react";
import { BolaoToastProvider } from "@/app/components/BolaoToast";
import { AuthProvider } from "@/app/shared/AuthContext";
import { SidenavProvider } from "@/app/shared/SidenavContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BolaoToastProvider>
      <AuthProvider>
        <SidenavProvider>{children}</SidenavProvider>
      </AuthProvider>
    </BolaoToastProvider>
  );
}

