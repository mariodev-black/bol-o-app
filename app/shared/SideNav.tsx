"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Trophy, Radio, Target, Wallet, Users } from "lucide-react";
import logo from "@/app/assets/logo.png";

const NAV_ITEMS = [
  { label: "Home",      href: "/",         icon: Home   },
  { label: "Esportes",  href: "/esportes",  icon: Trophy },
  { label: "Ao Vivo",   href: "/ao-vivo",   icon: Radio  },
  { label: "Palpites",  href: "/palpites",  icon: Target },
  { label: "Meu Plano", href: "/meu-plano", icon: Wallet },
  { label: "Indicar",   href: "/indique",   icon: Users  },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex flex-col w-[220px] shrink-0 h-screen sticky top-0 bg-[#060B18] border-r border-white/[0.06] px-3 py-5"
    >
      {/* Logo */}
      <div className="px-2 mb-8">
        <Link href="/" aria-label="Início">
          <Image src={logo} alt="Bolão do Milhão" height={36} priority />
        </Link>
      </div>

      {/* Itens */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors duration-150",
                active
                  ? "bg-[#BA901E]/10 border border-[#BA901E]/20"
                  : "hover:bg-white/[0.04] border border-transparent",
              ].join(" ")}
            >
              <div
                className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
                style={
                  active
                    ? { background: "linear-gradient(180deg, #FFE8BA 0%, #BA901E 100%)", boxShadow: "0 0 12px rgba(255,175,47,0.45)" }
                    : { background: "rgba(255,255,255,0.05)" }
                }
              >
                <Icon
                  size={16}
                  style={{ color: active ? "#0E141B" : "rgba(255,255,255,0.50)" }}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </div>
              <span
                className="text-[13px] font-semibold leading-none"
                style={{ color: active ? "#BA901E" : "rgba(255,255,255,0.50)" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
