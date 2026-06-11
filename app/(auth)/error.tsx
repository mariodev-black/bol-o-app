"use client";

import { useEffect } from "react";
import { RouteErrorPage } from "@/app/shared/RouteErrorPage";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[auth/error]", error);
  }, [error]);

  return (
    <RouteErrorPage
      reset={reset}
      digest={error.digest}
      title="Erro ao carregar"
      message="Não foi possível abrir esta tela. Tente recarregar ou volte para o login."
    />
  );
}
