"use client";

import type { AdminBroadcastChannel } from "@/lib/notifications/admin-broadcast-shared";
import { Bell, Mail, Smartphone } from "lucide-react";

const CHANNELS: {
  id: AdminBroadcastChannel;
  label: string;
  description: string;
  icon: typeof Bell;
}[] = [
  {
    id: "app",
    label: "Sininho",
    description: "Lista de notificações dentro do app",
    icon: Bell,
  },
  {
    id: "push",
    label: "Push PWA",
    description: "Alerta no celular (quem instalou e ativou)",
    icon: Smartphone,
  },
  {
    id: "email",
    label: "E-mail",
    description: "Caixa de entrada via Resend",
    icon: Mail,
  },
];

const PRESETS: { label: string; channels: AdminBroadcastChannel[] }[] = [
  { label: "App completo", channels: ["app", "push"] },
  { label: "Só sininho", channels: ["app"] },
  { label: "Só push", channels: ["push"] },
  { label: "Só e-mail", channels: ["email"] },
  { label: "Tudo", channels: ["app", "push", "email"] },
];

function sameChannels(a: AdminBroadcastChannel[], b: AdminBroadcastChannel[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort().join(",");
  const sortedB = [...b].sort().join(",");
  return sortedA === sortedB;
}

export function AdminNotificationChannelPicker({
  channels,
  onChannelsChange,
}: {
  channels: AdminBroadcastChannel[];
  onChannelsChange: (channels: AdminBroadcastChannel[]) => void;
}) {
  function toggle(channel: AdminBroadcastChannel) {
    if (channels.includes(channel)) {
      const next = channels.filter((c) => c !== channel);
      onChannelsChange(next);
      return;
    }
    onChannelsChange([...channels, channel]);
  }

  return (
    <div className="mt-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
        Canais de disparo
      </p>
      <p className="mt-1 text-[12px] font-medium text-white/38">
        Marque um ou mais. Push PWA só chega para quem ativou notificações no app instalado.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active = sameChannels(channels, preset.channels);
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChannelsChange(preset.channels)}
              className={[
                "rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition-colors",
                active
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-white/12 bg-white/5 text-white/45 hover:text-white",
              ].join(" ")}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {CHANNELS.map((item) => {
          const active = channels.includes(item.id);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={[
                "flex flex-col items-start gap-2 rounded-[14px] border p-4 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/10"
                  : "border-white/10 bg-black/30 hover:border-white/20",
              ].join(" ")}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <Icon
                  className={[
                    "h-5 w-5",
                    active ? "text-primary" : "text-white/40",
                  ].join(" ")}
                  strokeWidth={2}
                />
                <span
                  className={[
                    "flex size-5 items-center justify-center rounded border text-[10px] font-black",
                    active
                      ? "border-primary bg-primary text-[#0E141B]"
                      : "border-white/20 text-transparent",
                  ].join(" ")}
                  aria-hidden
                >
                  ✓
                </span>
              </div>
              <span
                className={[
                  "text-[13px] font-black",
                  active ? "text-primary" : "text-white",
                ].join(" ")}
              >
                {item.label}
              </span>
              <span className="text-[11px] font-medium leading-snug text-white/40">
                {item.description}
              </span>
            </button>
          );
        })}
      </div>

      {channels.length === 0 ? (
        <p className="mt-3 text-[12px] font-bold text-red-300">
          Selecione pelo menos um canal.
        </p>
      ) : null}
    </div>
  );
}

export {
  channelIncludesApp,
  channelIncludesEmail,
  channelIncludesPush,
} from "@/lib/notifications/admin-broadcast-shared";
