"use client";

import { useEffect } from "react";

const SESSION_KEY = "bolao-chunk-reload-once";

function isChunkLoadFailure(message: string): boolean {
  return /loading chunk|chunkloaderror|failed to fetch dynamically imported module|importing a module script failed/i.test(
    message,
  );
}

/**
 * Após deploy, bundles antigos no cache do PWA/navegador podem falhar ao carregar.
 * Recarrega uma vez por sessão em vez de mostrar tela genérica em branco.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const tryReloadOnce = (reason: string) => {
      if (typeof window === "undefined") return;
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
      console.warn("[chunk-recovery] reloading after:", reason);
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      const message = String(event.message ?? event.error ?? "");
      if (isChunkLoadFailure(message)) {
        tryReloadOnce(message);
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "";
      if (isChunkLoadFailure(message)) {
        tryReloadOnce(message);
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
