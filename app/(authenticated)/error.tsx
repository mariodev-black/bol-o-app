"use client";

import { useEffect } from "react";
import { RouteErrorPage } from "@/app/shared/RouteErrorPage";

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[authenticated/error]", error);
  }, [error]);

  return (
    <RouteErrorPage
      reset={reset}
      digest={error.digest}
      showAppChrome
      message="Não conseguimos abrir esta tela agora. Recarregue ou volte para seus bolões."
    />
  );
}
