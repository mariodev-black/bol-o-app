"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BarChart2, CalendarClock, ChevronDown, FileText, Gift, Home, LogOut, Shield, Ticket, Trophy, User, X } from "lucide-react";
import { useAuth } from "@/app/shared/AuthContext";
import { useSidenav } from "@/app/shared/SidenavContext";
import logo from "@/app/assets/logo.svg";
import homeIcon from "@/app/assets/navbottom/home.svg";
import afiliadoIcon from "@/app/assets/navbottom/afiliado.svg";
import myBoloesIcon from "@/app/assets/navbottom/meus-bolao.svg";
import rankingIcon from "@/app/assets/navbottom/ranking.svg";
import premiacaoIcon from "@/app/assets/navbottom/premiacao.svg";

const BOTTOM_ITEMS_PROFILE = [
  { label: "Início", href: "/", icon: homeIcon, iconSize: 21 },
  { label: "Afiliado", href: "/indique", icon: afiliadoIcon, iconSize: 22 },
  { label: "Meus Bolões", href: "/boloes", icon: myBoloesIcon, iconSize: 25 },
  { label: "Premiação", href: "/premiacao", icon: premiacaoIcon, iconSize: 22 },
  { label: "Classificação", href: "/ranking", icon: rankingIcon, iconSize: 21 },
] as const;

const BOTTOM_ITEMS_PUBLIC = [
  { label: "Início", href: "/", icon: homeIcon, iconSize: 21 },
  { label: "Afiliado", href: "/cadastrar?from=%2Findique", icon: afiliadoIcon, iconSize: 22 },
  { label: "Meus Bolões", href: "/boloes", icon: myBoloesIcon, iconSize: 25 },
  { label: "Premiação", href: "/premiacao", icon: premiacaoIcon, iconSize: 22 },
  { label: "Classificação", href: "/ranking", icon: rankingIcon, iconSize: 21 },
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
    title: "JOGOS",
    items: [
      { label: "Página inicial", href: "/", icon: Home, subtitle: "Início" },
      { label: "Meus Bolões", href: "/boloes", icon: Trophy, subtitle: "Cotas e palpites" },
      { label: "Bolão do Dia", href: "/tickets?bolao=diario", icon: CalendarClock, subtitle: "Comprar diário" },
      { label: "Meus Palpites", href: "/meus-palpites", icon: BarChart2, subtitle: "Histórico e ranking" },
      { label: "Premiação", href: "/premiacao", icon: Gift, subtitle: "Prêmios oficiais" },
    ],
  },
  {
    title: "MINHA CONTA",
    items: [
      { label: "Minha Conta", href: "/perfil", icon: User, subtitle: "Perfil" },
      { label: "Adquirir Ticket", href: "/tickets", icon: Ticket, subtitle: "Comprar cota" },
    ],
  },
  {
    title: "PROMOÇÕES",
    items: [
      { label: "Indique e ganhe", href: "/indique", icon: Gift, subtitle: "Compartilhe" },
    ],
  },
  {
    title: "INFORMAÇÕES",
    items: [
      { label: "Política de Privacidade", href: "/privacidade", icon: FileText, subtitle: "Seus dados" },
    ],
  },
] as const;

export function NavBottom() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [optimisticBottomHref, setOptimisticBottomHref] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const openAnimRafRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const normalizedPath = useMemo(() => pathname ?? "", [pathname]);
  const { ready, isLoggedIn, user, logout } = useAuth();
  const { open, closeSidenav } = useSidenav();
  const bottomItems = useMemo(
    () => ((isLoggedIn ? BOTTOM_ITEMS_PROFILE : BOTTOM_ITEMS_PUBLIC) as readonly BottomItem[]),
    [isLoggedIn]
  );
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
    const hrefQuery = href.includes("?") ? new URLSearchParams(href.split("?")[1]) : null;
    if (href === "/") {
      return normalizedPath === "/";
    }
    if (baseHref === "/tickets") {
      const targetBolao = hrefQuery?.get("bolao") ?? null;
      const currentBolao = searchParams.get("bolao");
      if (targetBolao) return normalizedPath === "/tickets" && currentBolao === targetBolao;
      return normalizedPath === "/tickets" && !currentBolao;
    }
    if (baseHref === "/boloes/tickets") {
      return normalizedPath.startsWith("/boloes/tickets");
    }
    if (baseHref === "/boloes") {
      return (normalizedPath.startsWith("/boloes") && !normalizedPath.startsWith("/boloes/tickets")) || normalizedPath.startsWith("/palpites");
    }
    if (baseHref === "/ranking") {
      return normalizedPath.startsWith("/ranking");
    }
    return normalizedPath === baseHref || normalizedPath.startsWith(`${baseHref}/`);
  };

  const isBottomItemActive = (href: string) => {
    if (!optimisticBottomHref) return isItemActive(href);
    return (optimisticBottomHref.split("?")[0] ?? optimisticBottomHref) === (href.split("?")[0] ?? href);
  };

  const handleBottomNavigate = (href: string) => {
    setOptimisticBottomHref(href);
    router.prefetch(href);
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

  useEffect(() => {
    setOptimisticBottomHref(null);
  }, [normalizedPath]);

  useEffect(() => {
    if (!ready) return;
    bottomItems.forEach((item) => router.prefetch(item.href));
  }, [bottomItems, ready, router]);

  if (!ready) return null;

  const onHomeUnauthenticated = normalizedPath === "/" && !isLoggedIn;
  if (onHomeUnauthenticated) return null;

  return (
    <>
      {menuMounted && (
        <div className="fixed inset-0 z-9999 md:hidden" role="dialog" aria-modal="true" aria-label="Menu de navegação">
          <button
            type="button"
            onClick={closeMenu}
            className={[
              "absolute inset-0 transition-opacity duration-300",
              menuOpen ? "opacity-100" : "opacity-0",
            ].join(" ")}
            style={{
              background: "rgba(0,0,0,0.62)",
              backdropFilter: "blur(2px)",
            }}
            aria-label="Fechar menu"
          />

          <aside
            ref={panelRef}
            className={[
              "absolute left-0 top-0 h-full w-[340px] max-w-[86vw] overflow-hidden",
              "transition-transform duration-300 ease-out will-change-transform",
              menuOpen ? "translate-x-0" : "-translate-x-full",
            ].join(" ")}
            style={{
              background: "#080B0F",
              boxShadow: "28px 0 50px rgba(0,0,0,0.58), inset -1px 0 0 rgba(255,255,255,0.06)",
            }}
          >
            <div className="relative flex h-full flex-col">
              <div className="flex h-[90px] items-center justify-between border-b px-7" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <Link href="/" onClick={closeMenu} aria-label="Início" className="flex items-center">
                  <Image src={logo} alt="Bolão do Milhão" width={164} height={38} priority className="h-auto w-[164px]" />
                </Link>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white/65 transition-colors hover:text-white"
                  aria-label="Fechar menu lateral"
                >
                  <X className="h-5 w-5" strokeWidth={2.1} />
                </button>
              </div>

              <div className="relative flex-1 overflow-y-auto pb-6 pt-5">
                <div className="flex flex-col gap-6">
                  {MENU_SECTIONS.map((section) => (
                    <section key={section.title}>
                      <div className="mb-3 flex items-center justify-between px-7">
                        <h3 className="text-[12px] font-black uppercase tracking-[0.13em]" style={{ color: "#B1EB0B" }}>
                          {section.title}
                        </h3>
                        <ChevronDown className="h-4 w-4" style={{ color: "rgba(177,235,11,0.58)" }} strokeWidth={2.2} />
                      </div>

                      <div className="flex flex-col">
                        {section.items.map((item) => {
                          const baseHref = item.href.split("?")[0];
                          const active = isItemActive(baseHref) || isItemActive(item.href);
                          const Icon = item.icon;

                          return (
                            <Link
                              key={item.href + item.label}
                              href={item.href}
                              onClick={closeMenu}
                              className="group relative flex h-[56px] items-center gap-4 overflow-hidden px-7 transition-colors"
                              style={{
                                background: active ? "rgba(177,235,11,0.12)" : "transparent",
                              }}
                            >
                              {active ? <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-primary" /> : null}
                              <Icon
                                className="h-[22px] w-[22px] shrink-0"
                                style={{ color: active ? "#B1EB0B" : "rgba(255,255,255,0.48)" }}
                                strokeWidth={active ? 2.2 : 1.9}
                              />
                              <span
                                className="min-w-0 flex-1 truncate text-[17px] font-semibold leading-none"
                                style={{ color: active ? "#B1EB0B" : "rgba(255,255,255,0.72)" }}
                              >
                                {item.label}
                              </span>
                              {active ? (
                                <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "rgba(177,235,11,0.58)" }} strokeWidth={2.4} />
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                  {isLoggedIn && (
                    <section>
                      <div className="mb-3 flex items-center justify-between px-7">
                        <h3 className="text-[12px] font-black uppercase tracking-[0.13em]" style={{ color: "rgba(248,113,113,0.88)" }}>
                          SESSÃO
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex h-[56px] w-full items-center gap-4 px-7 text-left transition-colors hover:bg-white/4"
                      >
                        <LogOut className="h-[22px] w-[22px] shrink-0" style={{ color: "#FCA5A5" }} strokeWidth={2} />
                        <span className="text-[17px] font-semibold leading-none" style={{ color: "#FCA5A5" }}>
                          Sair da conta
                        </span>
                      </button>
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
        {bottomItems.map(({ label, href, icon, iconSize }) => {
          const active = isBottomItemActive(href);

          return (
            <Link
              key={href + label}
              href={href}
              aria-current={active ? "page" : undefined}
              prefetch
              onClick={() => handleBottomNavigate(href)}
              onPointerEnter={() => router.prefetch(href)}
              onFocus={() => router.prefetch(href)}
              className="relative flex h-[58px] min-w-0 flex-1 items-end justify-center overflow-visible"
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute top-[4px] bottom-[4px] left-1/2 w-[59px] -translate-x-1/2"
                  style={{
                    background: "linear-gradient(180deg, #173006 0%, #102903 100%)",
                    clipPath: "polygon(12px 0, calc(100% - 12px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px)",
                    boxShadow: "inset 0 1px 0 rgba(177,235,11,0.18), 0 0 20px rgba(177,235,11,0.12)",
                  }}
                />
              ) : null}

              <span className="relative z-1 flex h-[54px] w-full flex-col items-center justify-center gap-[3px] px-2">
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
