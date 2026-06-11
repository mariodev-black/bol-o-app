"use client";

import { useEffect } from "react";
import { RouteErrorPage } from "@/app/shared/RouteErrorPage";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/error]", error);
  }, [error]);

  return (
    <RouteErrorPage
      reset={reset}
      digest={error.digest}
      title="Erro no painel admin"
      message="Não foi possível carregar esta página do admin. Recarregue ou volte."
    />
  );
}
