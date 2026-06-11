"use client";

import { useEffect } from "react";
import { RouteErrorPage } from "@/app/shared/RouteErrorPage";

export default function AdminPanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/panel/error]", error);
  }, [error]);

  return (
    <RouteErrorPage
      reset={reset}
      digest={error.digest}
      title="Erro no painel"
      message="Não foi possível carregar esta seção do admin. Recarregue para tentar novamente."
    />
  );
}
