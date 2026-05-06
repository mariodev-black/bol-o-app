"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, BarChart2, CalendarClock, Gift, Home, LogOut, Ticket, Trophy, User, Wallet, X } from "lucide-react";
import { useAuth } from "@/app/shared/AuthContext";
import { useSidenav } from "@/app/shared/SidenavContext";
import homeIcon from "@/app/assets/navbottom/home.svg";
import dailyIcon from "@/app/assets/navbottom/bolao.svg";
import myBoloesIcon from "@/app/assets/navbottom/meus-bolao.svg";
import rankingIcon from "@/app/assets/navbottom/ranking.svg";
import profileIcon from "@/app/assets/navbottom/perfil.svg";

const BOTTOM_ITEMS_PROFILE = [
  { label: "Início", href: "/", icon: homeIcon, iconSize: 21 },
  { label: "Bolão do Dia", href: "/tickets?bolao=diario", icon: dailyIcon, iconSize: 22 },
  { label: "Meus Bolões", href: "/boloes", icon: myBoloesIcon, iconSize: 25 },
  { label: "Ranking", href: "/meus-palpites", icon: rankingIcon, iconSize: 21 },
  { label: "Perfil", href: "/perfil", icon: profileIcon, iconSize: 21 },
] as const;

const BOTTOM_ITEMS_PUBLIC = [
  { label: "Início", href: "/", icon: homeIcon, iconSize: 21 },
  { label: "Bolão do Dia", href: "/login?from=/tickets%3Fbolao%3Ddiario", icon: dailyIcon, iconSize: 22 },
  { label: "Meus Bolões", href: "/boloes", icon: myBoloesIcon, iconSize: 25 },
  { label: "Ranking", href: "/meus-palpites", icon: rankingIcon, iconSize: 21 },
  { label: "Perfil", href: "/login", icon: profileIcon, iconSize: 21 },
] as const;

type BottomItem = {
  label: string;
  href: string;
  icon: StaticImageData;
  iconSize: number;
};

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
      { label: "Meus Palpites", href: "/meus-palpites", icon: CalendarClock, subtitle: "Últimas escolhas" },
      { label: "Meus Bolões", href: "/boloes", icon: BarChart2, subtitle: "Acompanhe sua jornada" },
    ],
  },
  {
    title: "FINANCEIRO",
    items: [
      { label: "Adquirir ticket", href: "/tickets", icon: Ticket, subtitle: "Garanta sua aposta", variant: "cta" },
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
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const openAnimRafRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const normalizedPath = useMemo(() => pathname ?? "", [pathname]);
  const { ready, isLoggedIn, user, logout } = useAuth();
  const { open, closeSidenav } = useSidenav();
  const userName = user?.name?.trim() || "Minha Conta";
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "MC";

  const isItemActive = (href: string) => {
    const baseHref = href.split("?")[0] ?? href;
    if (href === "/") {
      return normalizedPath === "/";
    }
    if (baseHref === "/boloes") {
      return normalizedPath.startsWith("/boloes") || normalizedPath.startsWith("/palpites");
    }
    if (baseHref === "/meus-palpites") {
      return normalizedPath.startsWith("/meus-palpites");
    }
    if (baseHref === "/tickets") {
      return normalizedPath.startsWith("/tickets");
    }
    return normalizedPath === baseHref || normalizedPath.startsWith(`${baseHref}/`);
  };

  const closeMenu = () => closeSidenav();
  const handleLogout = async () => {
    closeMenu();
    await logout();
    router.push("/login");
  };

  useEffect(() => {
    if (!ready) return;

    if (open) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
      if (openAnimRafRef.current != null) {
        cancelAnimationFrame(openAnimRafRef.current);
        openAnimRafRef.current = null;
      }
      // 1º commit: monta fora da tela (translate-x-full) para o CSS conseguir animar no próximo frame
      setMenuMounted(true);
      setMenuOpen(false);
      // Em alguns devices mobile, RAF duplo ainda pode "pular" a animação.
      // Este pequeno delay garante o paint inicial antes de iniciar o open.
      openTimerRef.current = window.setTimeout(() => {
        openTimerRef.current = null;
        void panelRef.current?.offsetHeight;
        setMenuOpen(true);
      }, 24);
      return;
    }

    if (openAnimRafRef.current != null) {
      cancelAnimationFrame(openAnimRafRef.current);
      openAnimRafRef.current = null;
    }
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setMenuOpen(false);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    // duração alinhada ao transition-transform duration-300 do painel
    closeTimerRef.current = window.setTimeout(() => setMenuMounted(false), 320);
  }, [open, ready]);

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
      if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
      if (openAnimRafRef.current != null) cancelAnimationFrame(openAnimRafRef.current);
    };
  }, []);

  if (!ready) return null;

  const onHomeUnauthenticated = normalizedPath === "/" && !isLoggedIn;
  if (onHomeUnauthenticated) return null;

  return (
    <>
      {menuMounted && (
        <div className="fixed inset-0 z-9999 md:hidden" role="dialog" aria-modal="true" aria-label="Menu de navegação">
          <style jsx>{`
            @keyframes navCtaPingBorder {
              0% {
                box-shadow:
                  0 0 0 0 rgba(217, 255, 89, 0.0),
                  0 0 0 1px rgba(217, 255, 89, 0.26) inset;
              }
              60% {
                box-shadow:
                  0 0 0 5px rgba(217, 255, 89, 0.12),
                  0 0 0 1px rgba(177, 235, 11, 0.36) inset;
              }
              75%,
              100% {
                box-shadow:
                  0 0 0 10px rgba(217, 255, 89, 0.0),
                  0 0 0 1px rgba(217, 255, 89, 0.26) inset;
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
                "radial-gradient(120% 85% at 100% 0%, rgba(177,235,11,0.15) 0%, rgba(0,0,0,0.74) 58%), rgba(0,0,0,0.76)",
              backdropFilter: "blur(4px)",
            }}
            aria-label="Fechar menu"
          />

          <aside
            ref={panelRef}
            className={[
              "absolute inset-0 h-full w-full overflow-hidden",
              "transition-transform duration-300 ease-out will-change-transform",
              menuOpen ? "translate-x-0" : "translate-x-full",
            ].join(" ")}
            style={{
              background:
                "radial-gradient(120% 72% at 5% 0%, rgba(217,255,89,0.14) 0%, rgba(217,255,89,0) 55%), radial-gradient(85% 70% at 100% 100%, rgba(177,235,11,0.16) 0%, rgba(177,235,11,0) 60%), linear-gradient(180deg, #060B18 0%, #040913 72%, #03070F 100%)",
              boxShadow: "rgba(0,0,0,0.78) 0px 30px 90px -22px, rgba(177,235,11,0.18) 0px 0px 0px 1px inset",
            }}
          >

            <div className="relative flex h-full flex-col">
              <div className="px-5 pt-5 pb-4">
                <div
                  className="rounded-3xl border p-4"
                  style={{
                    borderColor: "rgba(177,235,11,0.32)",
                    background:
                      "linear-gradient(180deg, rgba(217,255,89,0.09) 0%, rgba(217,255,89,0.03) 100%), rgba(8,14,27,0.82)",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.36), 0 0 0 1px rgba(255,255,255,0.04) inset",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center border"
                        style={{
                          background: "linear-gradient(180deg, rgba(217,255,89,0.25) 0%, rgba(177,235,11,0.10) 100%)",
                          borderColor: "rgba(177,235,11,0.35)",
                          boxShadow: "0 0 26px rgba(177,235,11,0.2)",
                        }}
                        aria-hidden="true"
                      >
                        <span className="text-[13px] font-black" style={{ color: "#E8FF8A" }}>
                          {initials}
                        </span>
                      </div>
                      <div className="leading-tight">
                        <p className="text-[14px] font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
                          {userName}
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
                        background: "rgba(177,235,11,0.08)",
                        borderColor: "rgba(177,235,11,0.24)",
                      }}
                      aria-label="Fechar menu lateral"
                    >
                      <X className="w-5 h-5 text-[#E8FF8A]" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { value: "32", label: "PTS", color: "#D7FF59" },
                      { value: "#6", label: "POSIÇÃO", color: "#E8FF8A" },
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
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(217,255,89,0.72)" }} />
                        <h3 className="text-[10px] font-black tracking-[0.22em] uppercase" style={{ color: "rgba(217,255,89,0.62)" }}>
                          {section.title}
                        </h3>
                        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(177,235,11,0.35) 0%, rgba(177,235,11,0) 100%)" }} />
                      </div>

                      <div className="mt-3 flex flex-col gap-2.5">
                        {section.items.map((item) => {
                          const baseHref = item.href.split("?")[0];
                          const active = isItemActive(baseHref) || isItemActive(item.href);
                          const Icon = item.icon;
                          const isCta = item.variant === "cta";

                          const labelColor = isCta ? "#0E141B" : active ? "#E8FF8A" : "rgba(255,255,255,0.94)";
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
                                  ? "linear-gradient(180deg, rgba(217,255,89,1) 0%, rgba(177,235,11,1) 100%)"
                                  : active
                                    ? "linear-gradient(120deg, rgba(217,255,89,0.18) 0%, rgba(177,235,11,0.08) 50%, rgba(255,255,255,0.02) 100%)"
                                    : "linear-gradient(120deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                                borderColor: isCta ? "rgba(0,0,0,0.12)" : active ? "rgba(177,235,11,0.45)" : "rgba(255,255,255,0.14)",
                                boxShadow: isCta ? "0 0 0 1px rgba(217,255,89,0.22) inset" : active ? "0 8px 28px rgba(177,235,11,0.14)" : "none",
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
                                    background: isCta ? "rgba(14,20,27,0.12)" : active ? "rgba(177,235,11,0.14)" : "rgba(8,14,27,0.75)",
                                    borderColor: isCta ? "rgba(0,0,0,0.12)" : active ? "rgba(177,235,11,0.4)" : "rgba(255,255,255,0.14)",
                                  }}
                                  aria-hidden="true"
                                >
                                  <Icon
                                    className="w-5 h-5"
                                    style={{ color: isCta ? "#0E141B" : active ? "#E8FF8A" : "rgba(255,255,255,0.64)" }}
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
                                style={{ color: isCta ? "rgba(14,20,27,0.65)" : active ? "#E8FF8A" : "rgba(255,255,255,0.45)" }}
                              />
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                  {isLoggedIn && (
                    <section>
                      <div className="flex items-center gap-2.5 px-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(248,113,113,0.9)" }} />
                        <h3 className="text-[10px] font-black tracking-[0.22em] uppercase" style={{ color: "rgba(248,113,113,0.8)" }}>
                          SESSÃO
                        </h3>
                        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(248,113,113,0.45) 0%, rgba(248,113,113,0) 100%)" }} />
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full group relative flex items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-200"
                          style={{
                            background: "linear-gradient(120deg, rgba(248,113,113,0.2) 0%, rgba(127,29,29,0.35) 100%)",
                            borderColor: "rgba(248,113,113,0.38)",
                          }}
                        >
                          <div className="relative flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200"
                              style={{
                                background: "rgba(127,29,29,0.5)",
                                borderColor: "rgba(248,113,113,0.4)",
                              }}
                              aria-hidden="true"
                            >
                              <LogOut className="w-5 h-5" style={{ color: "#FCA5A5" }} strokeWidth={2.2} />
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="text-[13px] font-black truncate" style={{ color: "#FECACA" }}>
                                Sair da conta
                              </p>
                              <p className="text-[11px] truncate" style={{ color: "rgba(254,202,202,0.75)" }}>
                                Encerrar sessão neste dispositivo
                              </p>
                            </div>
                          </div>
                          <ArrowRight
                            className="relative w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                            style={{ color: "rgba(254,202,202,0.9)" }}
                          />
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-60 mx-auto flex h-[58px] w-full items-end overflow-visible rounded-t-[13px] border border-[#2A2A2A] bg-[#101010] md:hidden"
        style={{
          boxShadow: "0 -12px 26px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
        aria-label="Navegação inferior"
      >
        {((isLoggedIn ? BOTTOM_ITEMS_PROFILE : BOTTOM_ITEMS_PUBLIC) as readonly BottomItem[]).map(({ label, href, icon, iconSize }) => {
          const active = isItemActive(href);

          return (
            <Link
              key={href + label}
              href={href}
              aria-current={active ? "page" : undefined}
              className="relative flex h-[58px] min-w-0 flex-1 items-end justify-center overflow-visible"
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-[6px] bottom-0 left-1/2 w-[59px] -translate-x-1/2"
                  style={{
                    background: "linear-gradient(180deg, #173006 0%, #102903 100%)",
                    clipPath: "polygon(12px 0, calc(100% - 12px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px)",
                    boxShadow: "inset 0 1px 0 rgba(177,235,11,0.18), 0 0 20px rgba(177,235,11,0.12)",
                  }}
                />
              ) : null}

              <span className="relative z-1 flex h-[54px] w-full flex-col items-center justify-center gap-[3px]">
                <Image
                  src={icon}
                  alt=""
                  width={iconSize}
                  height={iconSize}
                  className="h-auto w-auto transition-all duration-200"
                  style={{
                    filter: active
                      ? "brightness(0) saturate(100%) invert(78%) sepia(77%) saturate(833%) hue-rotate(21deg) brightness(101%) contrast(93%)"
                      : "brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(88%)",
                  }}
                  aria-hidden="true"
                />
                <span
                  className={[
                    "block max-w-full truncate text-center leading-none",
                    active ? "text-[10px] font-black" : "text-[10px] font-semibold",
                  ].join(" ")}
                  style={{ color: active ? "#B1EB0B" : "#929292" }}
                >
                  {label}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
