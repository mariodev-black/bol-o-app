"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, Target, Trophy, Wallet, X } from "lucide-react";

const BOTTOM_ITEMS = [
  { label: "Meus Palpites", href: "/palpites", icon: Target },
  { label: "Meus Bolões", href: "/dashboard", icon: Trophy },
  { label: "Início", href: "/dashboard", icon: Home },
  { label: "Depósito", href: "/saques", icon: Wallet },
] as const;

const MENU_ITEMS = [
  { label: "Início", href: "/dashboard" },
  { label: "Meus Palpites", href: "/palpites" },
  { label: "Indique e Ganhe", href: "/indique" },
  { label: "Depósito / Saques", href: "/saques" },
  { label: "Termos", href: "/termos" },
  { label: "Privacidade", href: "/privacidade" },
] as const;

export function NavBottom() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const normalizedPath = useMemo(() => pathname ?? "", [pathname]);

  const isItemActive = (href: string) => {
    if (href === "/dashboard") {
      return normalizedPath === "/" || normalizedPath.startsWith("/dashboard");
    }
    return normalizedPath === href || normalizedPath.startsWith(`${href}/`);
  };

  return (
    <>
      {menuOpen && (
        <div
          className="fixed inset-0 z-70 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-[86%] max-w-[320px] bg-[#0b1323] border-l border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <h2 className="text-[16px] font-bold text-white">Menu</h2>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5 border border-white/10"
                aria-label="Fechar menu lateral"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>
            </div>

            <nav className="px-3 py-3 flex flex-col gap-1.5">
              {MENU_ITEMS.map((item) => {
                const active = isItemActive(item.href);
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-3 text-[14px] font-semibold transition-colors"
                    style={{
                      background: active ? "rgba(59, 130, 246, 0.16)" : "transparent",
                      borderLeft: active ? "3px solid #3B82F6" : "3px solid transparent",
                      color: active ? "#ffffff" : "rgba(255,255,255,0.78)",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-60 flex items-center gap-1 w-full justify-between bg-card border-t border-white/10 md:hidden">
        {BOTTOM_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = isItemActive(href);

          return (
            <Link
              key={href + label}
              href={href}
              className="flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-full transition-all duration-200"
              style={{ minWidth: 64 }}
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200"
                style={
                  active
                    ? {
                        background: "linear-gradient(180deg, #FFE8BA 0%, #D4AF37 100%)",
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

              <span
                className="text-[10px] font-medium leading-none text-center"
                style={{
                  color: active ? "#D4AF37" : "rgba(255,255,255,0.45)",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-full transition-all duration-200"
          style={{ minWidth: 64 }}
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200">
            <Menu className="w-5 h-5" style={{ color: "rgba(255,255,255,0.55)" }} strokeWidth={1.9} />
          </div>
          <span className="text-[10px] font-medium leading-none text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
            Menu
          </span>
        </button>
      </nav>
    </>
  );
}
