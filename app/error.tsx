"use client";

import { useEffect } from "react";
import { RouteErrorPage } from "@/app/shared/RouteErrorPage";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <RouteErrorPage
      reset={reset}
      digest={error.digest}
      message="Algo deu errado ao carregar esta página. Recarregue ou volte para o início do bolão."
    />
  );
}
