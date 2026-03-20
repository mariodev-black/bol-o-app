"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Radio, Target, Wallet } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Esportes", href: "/esportes", icon: Trophy },
  { label: "Ao Vivo", href: "/ao-vivo", icon: Radio },
  { label: "Palpites", href: "/palpites", icon: Target },
  { label: "Meu Plano", href: "/meu-plano", icon: Wallet },
];

export function NavBottom() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 w-full justify-between bg-card"
    >
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center gap-1 px-4 py-1.5 rounded-full transition-all duration-200"
            style={{ minWidth: 64 }}
          >
            {/* Ícone com ou sem fundo ativo */}
            <div
              className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200"
              style={
                active
                  ? {
                    background: "linear-gradient(180deg, #FFE8BA 0%, #FFAF2F 100%)",
                    boxShadow: "0 0 16px rgba(255,175,47,0.6), 0 0 32px rgba(255,175,47,0.25)",
                  }
                  : { background: "transparent" }
              }
            >
              <Icon
                className="w-5 h-5"
                style={{ color: active ? "#0E141B" : "rgba(255,255,255,0.55)" }}
                strokeWidth={active ? 2.5 : 1.8}
              />
            </div>

            {/* Label */}
            <span
              className="text-[11px] font-medium leading-none"
              style={{
                color: active ? "#FFAF2F" : "rgba(255,255,255,0.45)",
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
