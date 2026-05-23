"use client";

import { useAuth } from "@/app/shared/AuthContext";
import {
  isPushSupported,
  registerPwaServiceWorker,
} from "@/lib/push/client";
import { dispatchPwaInstalled } from "@/lib/push/push-prompt";
import { useEffect, useRef } from "react";

/**
 * Registra o service worker em sessões logadas (base do PWA + push).
 * O pedido de permissão fica no PushNotificationsBanner.
 */
export function PwaManager() {
  const { ready, isLoggedIn } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!ready || !isLoggedIn || registeredRef.current) return;
    if (!isPushSupported()) return;

    registeredRef.current = true;
    void registerPwaServiceWorker();
  }, [ready, isLoggedIn]);

  useEffect(() => {
    if (!ready || !isLoggedIn) return;

    const onAppInstalled = () => {
      dispatchPwaInstalled();
    };

    window.addEventListener("appinstalled", onAppInstalled);
    return () => window.removeEventListener("appinstalled", onAppInstalled);
  }, [ready, isLoggedIn]);

  return null;
}
