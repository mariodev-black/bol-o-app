"use client";

import { Bell, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  enablePushNotifications,
  isPushSupported,
  isStandalonePwa,
} from "@/lib/push/client";
import {
  persistPushPromptDismissed,
  readPushPromptDismissed,
  shouldOfferPushNotificationsModal,
} from "@/lib/push/push-prompt";
import { useAuth } from "@/app/shared/AuthContext";

export function PushNotificationsBanner() {
  const { ready, isLoggedIn } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !isLoggedIn) {
      setVisible(false);
      return;
    }
    if (!isPushSupported()) return;
    if (readPushPromptDismissed()) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    if (shouldOfferPushNotificationsModal(true, true)) return;

    const t = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(t);
  }, [ready, isLoggedIn]);

  const handleDismiss = useCallback(() => {
    persistPushPromptDismissed();
    setVisible(false);
  }, []);

  const handleEnable = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const result = await enablePushNotifications();
    setLoading(false);

    if (result.ok) {
      persistPushPromptDismissed();
      setVisible(false);
      return;
    }

    if (result.reason === "denied") {
      setMessage("Permissão negada. Ative nas configurações do navegador.");
      persistPushPromptDismissed();
    } else if (result.reason === "no-vapid") {
      setMessage("Push ainda não configurado no servidor.");
    } else {
      setMessage("Não foi possível ativar. Tente de novo após instalar o app.");
    }
  }, []);

  if (!visible) return null;

  const pwaHint = isStandalonePwa()
    ? "Receba avisos mesmo com o app fechado."
    : "Instale o app na tela inicial e receba avisos importantes.";

  return (
    <div
      className="border-b border-primary/25 bg-primary/8 px-3 py-2.5 sm:px-5"
      role="region"
      aria-label="Ativar notificações push"
    >
      <div className="mx-auto flex max-w-[1500px] items-start gap-2 sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/8 hover:text-white sm:mt-0"
          aria-label="Fechar"
        >
          <X className="size-4" strokeWidth={2.25} />
        </button>
        <Bell className="mt-1 size-5 shrink-0 text-primary sm:mt-0" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-white sm:text-[13px]">
            Ativar notificações no celular
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-white/45">{pwaHint}</p>
          {message ? (
            <p className="mt-1 text-[11px] font-bold text-amber-300/90">{message}</p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleEnable()}
          className="shrink-0 rounded-[10px] bg-primary px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#0E141B] disabled:opacity-50 sm:text-[11px]"
        >
          {loading ? "..." : "Ativar"}
        </button>
      </div>
    </div>
  );
}
