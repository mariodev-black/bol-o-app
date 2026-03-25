"use client";

import React from "react";
import { AuthProvider } from "@/app/shared/AuthContext";
import { SidenavProvider } from "@/app/shared/SidenavContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidenavProvider>{children}</SidenavProvider>
    </AuthProvider>
  );
}

