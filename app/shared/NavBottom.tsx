"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, BarChart2, CalendarClock, Gift, Home, Menu, Ticket, Trophy, User, UserPlus, Wallet, X } from "lucide-react";

const BOTTOM_ITEMS = [
  { label: "Indique", href: "/indique", icon: UserPlus },
  { label: "Meus Bolões", href: "/boloes", icon: Trophy },
  { label: "Início", href: "/", icon: Home },
  { label: "Adquirir ticket", href: "/cadastrar", icon: Ticket },
] as const;

type MenuItem = {
  label: string;
  href: string;
  icon: ElementType;
  subtitle: string;
  variant?: "cta";
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const MENU_SECTIONS: MenuSection[] = [
  {
    title: "BOLÕES",
    items: [
      { label: "Copa do Mundo 2026", href: "/boloes", icon: Trophy, subtitle: "Jogos e palpites" },
      { label: "Meus Palpites", href: "/palpites?bolao=principal", icon: CalendarClock, subtitle: "Últimas escolhas" },
      { label: "Meus Bolões", href: "/boloes", icon: BarChart2, subtitle: "Acompanhe sua jornada" },
    ],
  },
  {
    title: "FINANCEIRO",
    items: [
      { label: "Adquirir ticket", href: "/cadastrar", icon: Ticket, subtitle: "Garanta sua aposta", variant: "cta" },
      { label: "Saques", href: "/saques", icon: Wallet, subtitle: "Retiradas do saldo" },
    ],
  },
  {
    title: "CONTA",
    items: [
      { label: "Indique e Ganhe", href: "/indique", icon: Gift, subtitle: "Compartilhe e ganhe" },
      { label: "Meu Perfil", href: "/perfil", icon: User, subtitle: "Dados da sua conta" },
      { label: "Privacidade", href: "/privacidade", icon: Home, subtitle: "Transparência e dados" },
    ],
  },
] as const;

export function NavBottom() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const normalizedPath = useMemo(() => pathname ?? "", [pathname]);

  const isItemActive = (href: string) => {
    if (href === "/") {
      return normalizedPath === "/";
    }
    if (href === "/boloes") {
      return normalizedPath.startsWith("/boloes") || normalizedPath.startsWith("/palpites");
    }
    return normalizedPath === href || normalizedPath.startsWith(`${href}/`);
  };

  const openMenu = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setMenuMounted(true);
    setMenuOpen(false);
    requestAnimationFrame(() => setMenuOpen(true));
  };

  const closeMenu = () => {
    setMenuOpen(false);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setMenuMounted(false), 260);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    if (!menuOpen) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <>
      {menuMounted && (
        <div className="fixed inset-0 z-9999 md:hidden" role="dialog" aria-modal="true" aria-label="Menu de navegação">
          <style jsx>{`
            @keyframes navCtaPingBorder {
              0% {
                box-shadow:
                  0 0 0 0 rgba(255, 232, 186, 0.0),
                  0 0 0 1px rgba(255, 232, 186, 0.26) inset;
              }
              60% {
                box-shadow:
                  0 0 0 5px rgba(255, 232, 186, 0.12),
                  0 0 0 1px rgba(212, 175, 55, 0.36) inset;
              }
              75%,
              100% {
                box-shadow:
                  0 0 0 10px rgba(255, 232, 186, 0.0),
                  0 0 0 1px rgba(255, 232, 186, 0.26) inset;
              }
            }
          `}</style>
          <button
            type="button"
            onClick={closeMenu}
            className={[
              "absolute inset-0 transition-opacity duration-300",
              menuOpen ? "opacity-100" : "opacity-0",
            ].join(" ")}
            style={{
              background:
                "radial-gradient(120% 85% at 100% 0%, rgba(212,175,55,0.15) 0%, rgba(0,0,0,0.74) 58%), rgba(0,0,0,0.76)",
              backdropFilter: "blur(4px)",
            }}
            aria-label="Fechar menu"
          />

          <aside
            className={[
              "absolute inset-0 h-full w-full overflow-hidden",
              "transition-transform duration-300 ease-out will-change-transform",
              menuOpen ? "translate-x-0" : "translate-x-full",
            ].join(" ")}
            style={{
              background:
                "radial-gradient(120% 72% at 5% 0%, rgba(255,232,186,0.14) 0%, rgba(255,232,186,0) 55%), radial-gradient(85% 70% at 100% 100%, rgba(212,175,55,0.16) 0%, rgba(212,175,55,0) 60%), linear-gradient(180deg, #060B18 0%, #040913 72%, #03070F 100%)",
              boxShadow: "rgba(0,0,0,0.78) 0px 30px 90px -22px, rgba(212,175,55,0.18) 0px 0px 0px 1px inset",
            }}
          >

            <div className="relative flex h-full flex-col">
              <div className="px-5 pt-5 pb-4">
                <div
                  className="rounded-3xl border p-4"
                  style={{
                    borderColor: "rgba(212,175,55,0.32)",
                    background:
                      "linear-gradient(180deg, rgba(255,232,186,0.09) 0%, rgba(255,232,186,0.03) 100%), rgba(8,14,27,0.82)",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.36), 0 0 0 1px rgba(255,255,255,0.04) inset",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center border"
                        style={{
                          background: "linear-gradient(180deg, rgba(255,232,186,0.25) 0%, rgba(212,175,55,0.10) 100%)",
                          borderColor: "rgba(212,175,55,0.35)",
                          boxShadow: "0 0 26px rgba(255,175,47,0.2)",
                        }}
                        aria-hidden="true"
                      >
                        <span className="text-[13px] font-black" style={{ color: "#FFE8BA" }}>
                          PA
                        </span>
                      </div>
                      <div className="leading-tight">
                        <p className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
                          Pedro Alves
                        </p>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                          Acompanhe seus tickets e palpites
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={closeMenu}
                      className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200"
                      style={{
                        background: "rgba(212,175,55,0.08)",
                        borderColor: "rgba(212,175,55,0.24)",
                      }}
                      aria-label="Fechar menu lateral"
                    >
                      <X className="w-5 h-5 text-[#FFE8BA]" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { value: "32", label: "PTS", color: "#DAB682" },
                      { value: "#6", label: "POSIÇÃO", color: "#FFE8BA" },
                      { value: "68%", label: "ACERTOS", color: "#86EFAC" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border px-2.5 py-2.5"
                        style={{
                          background: "rgba(255,255,255,0.035)",
                          borderColor: "rgba(255,255,255,0.13)",
                        }}
                      >
                        <p className="text-[20px] font-black leading-none" style={{ color: stat.color }}>
                          {stat.value}
                        </p>
                        <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.56)" }}>
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative flex-1 overflow-y-auto px-4 pb-6">
                <div className="flex flex-col gap-5">
                  {MENU_SECTIONS.map((section) => (
                    <section key={section.title}>
                      <div className="flex items-center gap-2.5 px-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,232,186,0.72)" }} />
                        <h3 className="text-[10px] font-black tracking-[0.22em] uppercase" style={{ color: "rgba(255,232,186,0.62)" }}>
                          {section.title}
                        </h3>
                        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(212,175,55,0.35) 0%, rgba(212,175,55,0) 100%)" }} />
                      </div>

                      <div className="mt-3 flex flex-col gap-2.5">
                        {section.items.map((item) => {
                          const baseHref = item.href.split("?")[0];
                          const active = isItemActive(baseHref) || isItemActive(item.href);
                          const Icon = item.icon;
                          const isCta = item.variant === "cta";

                          const labelColor = isCta ? "#0E141B" : active ? "#FFE8BA" : "rgba(255,255,255,0.94)";
                          const subtitleColor = isCta ? "rgba(14,20,27,0.65)" : active ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.45)";

                          return (
                            <Link
                              key={item.href + item.label}
                              href={item.href}
                              onClick={closeMenu}
                              className={[
                                "group relative flex items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-200",
                                isCta ? "overflow-visible" : "overflow-hidden",
                              ].join(" ")}
                              style={{
                                background: isCta
                                  ? "linear-gradient(180deg, rgba(255,232,186,1) 0%, rgba(212,175,55,1) 100%)"
                                  : active
                                    ? "linear-gradient(120deg, rgba(255,232,186,0.18) 0%, rgba(212,175,55,0.08) 50%, rgba(255,255,255,0.02) 100%)"
                                    : "linear-gradient(120deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                                borderColor: isCta ? "rgba(0,0,0,0.12)" : active ? "rgba(212,175,55,0.45)" : "rgba(255,255,255,0.14)",
                                boxShadow: isCta ? "0 0 0 1px rgba(255,232,186,0.22) inset" : active ? "0 8px 28px rgba(255,175,47,0.14)" : "none",
                                animation: isCta ? "navCtaPingBorder 1.35s cubic-bezier(0,0,.2,1) infinite" : undefined,
                              }}
                            >
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 opacity-60"
                                style={{
                                  background: isCta
                                    ? "linear-gradient(115deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.07) 100%)"
                                    : "linear-gradient(115deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0.04) 100%)",
                                }}
                              />

                              <div className="relative flex items-center gap-3 min-w-0">
                                <div
                                  className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200"
                                  style={{
                                    background: isCta ? "rgba(14,20,27,0.12)" : active ? "rgba(212,175,55,0.14)" : "rgba(8,14,27,0.75)",
                                    borderColor: isCta ? "rgba(0,0,0,0.12)" : active ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.14)",
                                  }}
                                  aria-hidden="true"
                                >
                                  <Icon
                                    className="w-5 h-5"
                                    style={{ color: isCta ? "#0E141B" : active ? "#FFE8BA" : "rgba(255,255,255,0.64)" }}
                                    strokeWidth={active ? 2.4 : 1.8}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <p className="text-[13px] font-black truncate" style={{ color: labelColor }}>
                                    {item.label}
                                  </p>
                                  <p className="text-[11px] truncate" style={{ color: subtitleColor }}>
                                    {item.subtitle}
                                  </p>
                                </div>
                              </div>

                              <ArrowRight
                                className="relative w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                                style={{ color: isCta ? "rgba(14,20,27,0.65)" : active ? "#FFE8BA" : "rgba(255,255,255,0.45)" }}
                              />
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-60 flex items-center gap-1 w-full justify-between bg-card border-t border-white/10 md:hidden"
        style={{ background: "rgba(6,11,24,0.78)", backdropFilter: "blur(10px)" }}
      >
        {BOTTOM_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = isItemActive(href);

          return (
            <Link
              key={href + label}
              href={href}
              className="flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-xl transition-all duration-200"
              style={{ minWidth: 64 }}
            >
              <div
                className={[
                  "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 border",
                  active ? "border-[#D4AF37]" : "border-white/10",
                ].join(" ")}
                style={
                  active
                    ? {
                        background: "linear-gradient(180deg, #FFE8BA 0%, #D4AF37 100%)",
                        boxShadow: "0 0 18px rgba(255,175,47,0.55), 0 0 34px rgba(255,175,47,0.22)",
                      }
                    : { background: "rgba(255,255,255,0.03)" }
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
                  color: active ? "#D4AF37" : "rgba(255,232,186,0.45)",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={openMenu}
          className="flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-xl transition-all duration-200"
          style={{ minWidth: 64 }}
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200">
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
