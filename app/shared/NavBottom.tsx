"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Award,
  BarChart2,
  BarChart3,
  ChevronDown,
  FileText,
  Gift,
  Home,
  LogOut,
  Share2,
  Ticket,
  Trophy,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/app/shared/AuthContext";
import { useSidenav } from "@/app/shared/SidenavContext";
import logo from "@/app/assets/logo.svg";

type BottomItem = {
  label: string;
  ariaLabel: string;
  href: string;
  icon: LucideIcon;
};

const BOTTOM_ITEMS_PROFILE: BottomItem[] = [
  { label: "Início", ariaLabel: "Início", href: "/", icon: Home },
  { label: "Indicar", ariaLabel: "Afiliado — indique e ganhe", href: "/indique", icon: Share2 },
  { label: "Palpites", ariaLabel: "Meus bolões e palpites", href: "/boloes", icon: Trophy },
  { label: "Prêmios", ariaLabel: "Premiação", href: "/premiacao", icon: Award },
  { label: "Ranking", ariaLabel: "Ranking", href: "/ranking", icon: BarChart3 },
];

const BOTTOM_ITEMS_PUBLIC: BottomItem[] = [
  { label: "Início", ariaLabel: "Início", href: "/", icon: Home },
  {
    label: "Indicar",
    ariaLabel: "Afiliado — cadastre-se para indicar",
    href: "/cadastrar?from=%2Findique",
    icon: Share2,
  },
  { label: "Palpites", ariaLabel: "Meus bolões e palpites", href: "/boloes", icon: Trophy },
  { label: "Prêmios", ariaLabel: "Premiação", href: "/premiacao", icon: Award },
  { label: "Ranking", ariaLabel: "Ranking", href: "/ranking", icon: BarChart3 },
];

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
  const { ready, isLoggedIn, logout } = useAuth();
  const { open, closeSidenav } = useSidenav();
  const bottomItems = useMemo(
    () => (isLoggedIn ? BOTTOM_ITEMS_PROFILE : BOTTOM_ITEMS_PUBLIC),
    [isLoggedIn],
  );

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
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-60 md:hidden"
        aria-label="Navegação inferior"
      >
        <div className="pointer-events-auto mx-auto max-w-lg px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2">
          <div
            className={[
              "relative flex items-stretch gap-0.5 rounded-[20px] border border-white/10 p-1",
              "bg-[#060a0e]/94 shadow-[0_-20px_50px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
              "backdrop-blur-xl backdrop-saturate-150 motion-safe:transition-[box-shadow,transform] motion-safe:duration-300",
            ].join(" ")}
          >
            {bottomItems.map(({ label, ariaLabel, href, icon: ItemIcon }) => {
              const active = isBottomItemActive(href);

              return (
                <Link
                  key={href + label}
                  href={href}
                  aria-label={ariaLabel}
                  aria-current={active ? "page" : undefined}
                  prefetch
                  onClick={() => handleBottomNavigate(href)}
                  onPointerEnter={() => router.prefetch(href)}
                  onFocus={() => router.prefetch(href)}
                  className={[
                    "group relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center rounded-[14px] py-1.5 outline-none",
                    "motion-safe:transition-[transform,color,background-color] motion-safe:duration-200 motion-safe:ease-out",
                    "active:scale-[0.94] motion-reduce:active:scale-100",
                    "focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060a0e]",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={[
                      "pointer-events-none absolute inset-x-0 top-0.5 bottom-0.5 rounded-[12px] motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.34,1.2,0.64,1)]",
                      active
                        ? "bg-primary/16 opacity-100 shadow-[0_0_28px_rgba(177,235,11,0.14)]"
                        : "bg-transparent opacity-0 group-hover:bg-white/4 group-hover:opacity-100",
                    ].join(" ")}
                  />
                  <span
                    aria-hidden
                    className={[
                      "pointer-events-none absolute left-1/2 top-1.5 h-[3px] w-6 -translate-x-1/2 rounded-full motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out",
                      active
                        ? "bg-primary opacity-100 shadow-[0_0_12px_rgba(177,235,11,0.75)]"
                        : "scale-x-50 bg-primary/0 opacity-0",
                    ].join(" ")}
                  />
                  <span className="relative z-10 flex flex-col items-center gap-0.5">
                    <span
                      className={[
                        "grid size-9 shrink-0 place-items-center rounded-xl motion-safe:transition-[transform,color] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.34,1.35,0.64,1)]",
                        active ? "text-primary motion-safe:scale-110" : "text-white/40 group-hover:text-white/65",
                      ].join(" ")}
                    >
                      <ItemIcon className="size-[21px]" strokeWidth={active ? 2.35 : 2} />
                    </span>
                    <span
                      className={[
                        "max-w-full px-0.5 text-center text-[9px] font-bold uppercase leading-tight tracking-[0.04em] min-[360px]:text-[10px]",
                        active ? "text-primary" : "text-white/45 group-hover:text-white/70",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
