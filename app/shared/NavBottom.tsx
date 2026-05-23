"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart2,
  BarChart3,
  ChevronDown,
  FileText,
  Gift,
  Home,
  LogOut,
  Share2,
  Smartphone,
  Target,
  Ticket,
  Trophy,
  User,
  X,
} from "lucide-react";
import { cn } from "@/app/lib/utils";
import { useAuth } from "@/app/shared/AuthContext";
import { useAppServerConfig } from "@/app/shared/AppServerConfigContext";
import {
  isBottomNavHomeActive,
  resolveBottomNavHref,
  resolveBottomNavHomeHref,
  type BottomNavHostContext,
} from "@/app/shared/bottom-nav-hrefs";
import { useSidenav } from "@/app/shared/SidenavContext";
import { isAppHostClient, isMarketingHostClient } from "@/lib/site-hosts-client";
import logo from "@/app/assets/logo.svg";

type BottomItem = {
  label: string;
  ariaLabel: string;
  href: string;
  icon: LucideIcon;
};

const BOTTOM_ITEMS_PROFILE: BottomItem[] = [
  { label: "INÍCIO", ariaLabel: "Início", href: "/", icon: Home },
  { label: "INDICAR", ariaLabel: "Afiliado — indique e ganhe", href: "/indique", icon: Share2 },
  { label: "PALPITES", ariaLabel: "Meus bolões e palpites", href: "/boloes", icon: Target },
  { label: "PRÊMIOS", ariaLabel: "Premiação", href: "/premiacao", icon: Gift },
  { label: "RANKING", ariaLabel: "Ranking", href: "/ranking", icon: BarChart3 },
];

const BOTTOM_ITEMS_PUBLIC: BottomItem[] = [
  { label: "INÍCIO", ariaLabel: "Início", href: "/", icon: Home },
  {
    label: "INDICAR",
    ariaLabel: "Afiliado — cadastre-se para indicar",
    href: "/cadastrar?from=%2Findique",
    icon: Share2,
  },
  { label: "PALPITES", ariaLabel: "Meus bolões e palpites", href: "/boloes", icon: Target },
  { label: "PRÊMIOS", ariaLabel: "Premiação", href: "/premiacao", icon: Gift },
  { label: "RANKING", ariaLabel: "Ranking", href: "/ranking", icon: BarChart3 },
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
      { label: "Baixar aplicativo", href: "/instalar-app", icon: Smartphone, subtitle: "PWA no celular" },
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

function BottomNavLink({
  item,
  active,
  currentPath,
  onNavigate,
  onPrefetch,
}: {
  item: BottomItem;
  active: boolean;
  currentPath: string;
  onNavigate: (href: string) => void;
  onPrefetch: (href: string) => void;
}) {
  const Icon = item.icon;
  const isExternal = item.href.startsWith("http");

  return (
    <Link
      href={item.href}
      aria-label={item.ariaLabel}
      aria-current={active ? "page" : undefined}
      prefetch={!isExternal}
      onClick={(e) => {
        onNavigate(item.href);
        const targetPath = isExternal
          ? new URL(item.href).pathname
          : (item.href.split("?")[0] ?? item.href);
        const sameDocument =
          !isExternal ||
          (typeof window !== "undefined" &&
            new URL(item.href).origin === window.location.origin);
        if (sameDocument && targetPath === currentPath) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
      onPointerEnter={() => onPrefetch(item.href)}
      onFocus={() => onPrefetch(item.href)}
      className={cn(
        "relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-end self-stretch outline-none",
        "transition-transform active:scale-95",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/50",
        active ? "z-30" : "z-0",
      )}
    >
      {active ? (
        <span
          className={cn(
            "absolute bottom-full left-1/2 z-30 flex size-[4.5rem] -translate-x-1/2 flex-col items-center justify-center gap-0.5",
            "mb-[-3rem] rounded-full bg-primary text-primary-foreground",
            "shadow-[0_0_28px_rgba(177,235,11,0.55)]",
          )}
        >
          <Icon className="size-6 shrink-0" strokeWidth={2.35} aria-hidden />
          <span className="max-w-[4.25rem] truncate text-center text-[10px] font-extrabold uppercase leading-none tracking-widest">
            {item.label}
          </span>
        </span>
      ) : null}

      <span
        className={cn(
          "flex flex-col items-center justify-center gap-1 py-2.5",
          active ? "pointer-events-none invisible" : "text-zinc-300",
        )}
        aria-hidden={active}
      >
        <Icon className="size-[22px] shrink-0" strokeWidth={2} aria-hidden />
        <span className="max-w-[4.5rem] truncate text-center text-[9px] font-extrabold uppercase leading-none tracking-widest min-[360px]:text-[10px]">
          {item.label}
        </span>
      </span>
    </Link>
  );
}

function BottomNavigation({
  items,
  currentPath,
  isActive,
  onNavigate,
  onPrefetch,
}: {
  items: BottomItem[];
  currentPath: string;
  isActive: (href: string) => boolean;
  onNavigate: (href: string) => void;
  onPrefetch: (href: string) => void;
}) {
  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] isolate overflow-visible md:hidden"
      aria-label="Navegação inferior"
    >
      <div className="pointer-events-auto w-full overflow-visible">
        <div className="overflow-visible pt-9">
          <div
            className={cn(
              "relative flex min-h-14 items-end justify-around overflow-visible ",
              "border border-white/[0.08] bg-black",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_-16px_48px_rgba(0,0,0,0.85)]",
            )}
          >
            {items.map((item) => (
              <BottomNavLink
                key={item.href + item.label}
                item={item}
                currentPath={currentPath}
                active={isActive(item.href)}
                onNavigate={onNavigate}
                onPrefetch={onPrefetch}
              />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

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
  const { appOrigin, marketingOrigin, subdomainRoutingEnabled } = useAppServerConfig();
  const { open, closeSidenav } = useSidenav();
  const onApp = isAppHostClient();
  const onMarketing = isMarketingHostClient();

  const navHostCtx: BottomNavHostContext = useMemo(
    () => ({
      isLoggedIn,
      onApp,
      onMarketing,
      subdomainRoutingEnabled,
      appOrigin,
      marketingOrigin,
    }),
    [isLoggedIn, onApp, onMarketing, subdomainRoutingEnabled, appOrigin, marketingOrigin],
  );

  const bottomItems = useMemo(() => {
    const template = isLoggedIn ? BOTTOM_ITEMS_PROFILE : BOTTOM_ITEMS_PUBLIC;
    return template.map((item) => ({
      ...item,
      href: resolveBottomNavHref(item.href, navHostCtx),
    }));
  }, [isLoggedIn, navHostCtx]);

  const homeHref = useMemo(() => resolveBottomNavHomeHref(navHostCtx), [navHostCtx]);
  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : undefined;

  const isItemActive = (href: string) => {
    if (isBottomNavHomeActive(href, normalizedPath, navHostCtx, currentOrigin)) {
      return true;
    }
    const baseHref = href.split("?")[0] ?? href;
    const hrefQuery = href.includes("?") ? new URLSearchParams(href.split("?")[1]) : null;
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
    bottomItems.forEach((item) => {
      if (!item.href.startsWith("http")) router.prefetch(item.href);
    });
  }, [bottomItems, ready, router]);

  if (!ready || !isLoggedIn) return null;

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
                <Link href={homeHref} onClick={closeMenu} aria-label="Início" className="flex items-center">
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
                          const menuHref = resolveBottomNavHref(item.href, navHostCtx);
                          const baseHref = menuHref.split("?")[0];
                          const active = isItemActive(menuHref);
                          const Icon = item.icon;

                          return (
                            <Link
                              key={item.href + item.label}
                              href={menuHref}
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

      <BottomNavigation
        items={bottomItems}
        currentPath={normalizedPath}
        isActive={isBottomItemActive}
        onNavigate={handleBottomNavigate}
        onPrefetch={(href) => {
          if (!href.startsWith("http")) router.prefetch(href);
        }}
      />
    </>
  );
}
