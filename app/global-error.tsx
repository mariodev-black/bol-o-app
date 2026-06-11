"use client";

import { useEffect } from "react";
import { RouteErrorPage } from "@/app/shared/RouteErrorPage";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-full bg-black text-white antialiased">
        <RouteErrorPage
          reset={reset}
          digest={error.digest}
          minimal
          title="Erro inesperado"
          message="Não foi possível carregar o aplicativo. Recarregue a página para tentar novamente."
        />
      </body>
    </html>
  );
}
