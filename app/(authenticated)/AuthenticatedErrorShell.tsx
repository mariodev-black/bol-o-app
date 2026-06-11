"use client";

import { AppErrorBoundary } from "@/app/shared/AppErrorBoundary";

/** Error boundary para rotas autenticadas (header/nav já vêm do layout). */
export function AuthenticatedErrorShell({ children }: { children: React.ReactNode }) {
  return <AppErrorBoundary>{children}</AppErrorBoundary>;
}
