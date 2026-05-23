"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  Ellipsis,
  EllipsisVertical,
  Plus,
  Share2,
  Smartphone,
} from "lucide-react";
import logoApp from "@/app/assets/logo-2.png";
import {
  detectInstallSheetPlatform,
  getInstallSiteHost,
  type InstallSheetPlatform,
} from "@/app/shared/install-app-banner";
import {
  enablePushNotifications,
  isPushSupported,
  isStandalonePwa,
  registerPwaServiceWorker,
} from "@/lib/push/client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function StepIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-white/14 bg-white/[0.08] align-middle text-white">
      {children}
    </span>
  );
}

function InstallStep({
  step,
  children,
}: {
  step: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#B1EB0B] text-[12px] font-black leading-none text-[#0E141B]">
        {step}
      </span>
      <p className="pt-0.5 text-[13px] font-medium leading-relaxed text-white/88">
        {children}
      </p>
    </li>
  );
}

function IosSteps() {
  return (
    <ol className="space-y-4">
      <InstallStep step={1}>
        Toque em <StepIcon><Ellipsis className="size-3.5" strokeWidth={2.5} /></StepIcon> para
        abrir o menu do Safari.
      </InstallStep>
      <InstallStep step={2}>
        Pressione <StepIcon><Share2 className="size-3.5" strokeWidth={2.25} /></StepIcon>{" "}
        <span className="text-white">Compartilhar</span> e depois{" "}
        <StepIcon><Ellipsis className="size-3.5" strokeWidth={2.5} /></StepIcon>{" "}
        <span className="text-white">Mais</span>.
      </InstallStep>
      <InstallStep step={3}>
        Selecione{" "}
        <StepIcon><Plus className="size-3.5" strokeWidth={2.5} /></StepIcon>{" "}
        <span className="text-white">Adicionar à Tela de Início</span>.
      </InstallStep>
      <InstallStep step={4}>
        Procure o ícone do Bolão do Milhão na tela inicial do iPhone.
      </InstallStep>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol className="space-y-4">
      <InstallStep step={1}>
        Toque no menu do navegador{" "}
        <StepIcon><EllipsisVertical className="size-3.5" strokeWidth={2.5} /></StepIcon> no canto
        superior da tela.
      </InstallStep>
      <InstallStep step={2}>
        Selecione{" "}
        <span className="text-white">Instalar app</span> ou{" "}
        <span className="text-white">Adicionar à tela inicial</span>.
      </InstallStep>
      <InstallStep step={3}>
        Confirme em{" "}
        <StepIcon><Download className="size-3.5" strokeWidth={2.25} /></StepIcon>{" "}
        <span className="text-white">Instalar</span> ou{" "}
        <StepIcon><Check className="size-3.5" strokeWidth={2.75} /></StepIcon>{" "}
        <span className="text-white">Adicionar</span>.
      </InstallStep>
      <InstallStep step={4}>
        Abra pelo ícone na tela inicial — experiência de app nativo, mais rápida.
      </InstallStep>
    </ol>
  );
}

export function InstallAppContent() {
  const siteHost = getInstallSiteHost();
  const [platform, setPlatform] = useState<InstallSheetPlatform>("android");
  const [installed, setInstalled] = useState(false);
  const [nativeInstallAvailable, setNativeInstallAvailable] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  useEffect(() => {
    setPlatform(detectInstallSheetPlatform());
    setInstalled(isStandalonePwa());
    void registerPwaServiceWorker();

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setNativeInstallAvailable(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleNativeInstall = useCallback(async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    deferredPromptRef.current = null;
    setNativeInstallAvailable(false);
    setInstalled(isStandalonePwa());
  }, []);

  return (
    <div className="space-y-6">
      {installed ? (
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3.5"
          style={{
            borderColor: "rgba(177,235,11,0.35)",
            background: "rgba(177,235,11,0.08)",
          }}
        >
          <Check className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2.5} />
          <div>
            <p className="text-[14px] font-bold text-white">App instalado</p>
            <p className="mt-1 text-[12px] font-medium text-white/50">
              Você está usando o Bolão do Milhão como aplicativo. Ative as notificações abaixo
              para não perder prazos de palpite.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5"
        >
          <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2} />
          <p className="text-[12px] font-medium leading-relaxed text-white/50">
            Instale no <strong className="text-white/80">celular</strong> para acesso rápido,
            ícone na tela inicial e notificações push. No computador, use o navegador normalmente.
          </p>
        </div>
      )}

      <div
        className="flex items-center gap-3 rounded-xl border px-3.5 py-3"
        style={{
          borderColor: "rgba(177,235,11,0.35)",
          background: "rgba(177,235,11,0.06)",
        }}
      >
        <Image
          src={logoApp}
          alt=""
          width={44}
          height={44}
          className="size-11 shrink-0 rounded-[10px] object-contain"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-white">Bolão do Milhão</p>
          <p className="truncate text-[12px] font-medium text-white/50">{siteHost}</p>
        </div>
      </div>

      {!installed ? (
        <>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
              Passo a passo — {platform === "ios" ? "iPhone (Safari)" : "Android"}
            </p>
            <div className="mt-4">
              {platform === "ios" ? <IosSteps /> : <AndroidSteps />}
            </div>
          </div>

          {nativeInstallAvailable && platform === "android" ? (
            <button
              type="button"
              onClick={() => void handleNativeInstall()}
              className="flex h-12 w-full items-center justify-center rounded-xl text-[12px] font-black uppercase tracking-wide text-[#0E141B] transition-transform active:scale-[0.98]"
              style={{
                background: "#B1EB0B",
                boxShadow: "0 0 16px rgba(177,235,11,0.22)",
              }}
            >
              Instalar agora
            </button>
          ) : null}
        </>
      ) : null}

      {isPushSupported() ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[13px] font-bold text-white">Notificações no celular</p>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-white/45">
            {platform === "ios"
              ? "No app instalado (iOS 16.4+), ative os avisos para lembretes de rodadas e prazos."
              : "Ative os avisos push para receber lembretes mesmo com o app fechado."}
          </p>
          {pushMessage ? (
            <p className="mt-2 text-[11px] font-bold text-primary">{pushMessage}</p>
          ) : null}
          <button
            type="button"
            disabled={pushLoading}
            onClick={() => {
              setPushLoading(true);
              setPushMessage(null);
              void enablePushNotifications().then((result) => {
                setPushLoading(false);
                if (result.ok) {
                  setPushMessage("Notificações ativadas com sucesso.");
                  return;
                }
                if (result.reason === "denied") {
                  setPushMessage("Permissão negada — ajuste nas configurações do navegador.");
                } else if (result.reason === "no-vapid") {
                  setPushMessage("Push temporariamente indisponível no servidor.");
                } else {
                  setPushMessage("Instale o app e tente novamente.");
                }
              });
            }}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-[11px] font-black uppercase tracking-wide text-primary disabled:opacity-50"
          >
            {pushLoading ? "Ativando..." : "Ativar notificações"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
