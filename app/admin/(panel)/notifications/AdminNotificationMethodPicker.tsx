"use client";

import type { AdminDeliveryMethod } from "@/lib/notifications/admin-broadcast-shared";
import { Bell, Mail, Megaphone } from "lucide-react";

const METHODS: {
  id: AdminDeliveryMethod;
  label: string;
  description: string;
  icon: typeof Bell;
}[] = [
  {
    id: "app",
    label: "App",
    description: "Sininho dentro do app",
    icon: Bell,
  },
  {
    id: "email",
    label: "E-mail",
    description: "Caixa de entrada (Resend)",
    icon: Mail,
  },
  {
    id: "both",
    label: "App + E-mail",
    description: "Os dois canais ao mesmo tempo",
    icon: Megaphone,
  },
];

export function AdminNotificationMethodPicker({
  method,
  onMethodChange,
}: {
  method: AdminDeliveryMethod;
  onMethodChange: (method: AdminDeliveryMethod) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
        Canal de envio
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {METHODS.map((item) => {
          const active = method === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onMethodChange(item.id)}
              className={[
                "flex flex-col items-start gap-2 rounded-[14px] border p-4 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/10"
                  : "border-white/10 bg-black/30 hover:border-white/20",
              ].join(" ")}
            >
              <Icon
                className={[
                  "h-5 w-5",
                  active ? "text-primary" : "text-white/40",
                ].join(" ")}
                strokeWidth={2}
              />
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
    </div>
  );
}

export function methodIncludesApp(method: AdminDeliveryMethod) {
  return method === "app" || method === "both";
}

export function methodIncludesEmail(method: AdminDeliveryMethod) {
  return method === "email" || method === "both";
}
