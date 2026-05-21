"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProductHref } from "@/app/shared/useProductHref";
import logo from "@/app/assets/logo.svg";
import { Menu as MenuIcon } from "lucide-react";
import { NotificationsBell } from "@/app/shared/NotificationsBell";
import { useAuth } from "@/app/shared/AuthContext";
import { useSidenav } from "@/app/shared/SidenavContext";
import { InstallAppBanner } from "@/app/shared/InstallAppBanner";
import {
  HEADER_MAIN_HEIGHT_DESKTOP_PX,
  HEADER_MAIN_HEIGHT_MOBILE_PX,
  readInstallBannerDismissed,
  syncAppHeaderHeightCss,
} from "@/app/shared/install-app-banner";

const NAV_LINKS_GUEST = [
  { label: "Como funciona?", href: "/#como-funciona", external: false },
  { label: "Sistema de pontos", href: "/#sistema-pontos", external: false },
  { label: "Cotas", href: "/#cotas", external: false },
  { label: "Criar conta gratuitamente", href: "/cadastrar?from=/tickets", external: true },
] as const;

const NAV_LINKS_LOGGED = [
  { label: "Home", href: "/" },
  { label: "Palpites", href: "/meus-palpites" },
  { label: "Ranking", href: "/ranking" },
  { label: "Premiação", href: "/premiacao" },
  { label: "Indique e ganhe", href: "/indique" },
  { label: "Regulamento", href: "/privacidade" },
];

function HeaderShell({
  showBanner,
  onDismissBanner,
  children,
}: {
  showBanner: boolean;
  onDismissBanner: () => void;
  children: React.ReactNode;
}) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 w-full bg-black"
      style={{ backgroundColor: "#000000" }}
    >
      {showBanner ? <InstallAppBanner onDismiss={onDismissBanner} /> : null}
      {children}
    </header>
  );
}

export function Header() {
  const pathname = usePathname();
  const { ready, isLoggedIn } = useAuth();
  const { openSidenav } = useSidenav();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerHydrated, setBannerHydrated] = useState(false);

  useEffect(() => {
    setBannerVisible(!readInstallBannerDismissed());
    setBannerHydrated(true);
  }, []);

  const isHomePage = (pathname ?? "") === "/";

  useEffect(() => {
    if (!bannerHydrated || !ready) return;

    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      const mainHeight = mq.matches
        ? HEADER_MAIN_HEIGHT_DESKTOP_PX
        : HEADER_MAIN_HEIGHT_MOBILE_PX;
      const showInstallBanner = bannerVisible && !isHomePage;
      syncAppHeaderHeightCss(showInstallBanner, mainHeight);
    };

    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [bannerVisible, bannerHydrated, ready, isHomePage]);

  const dismissBanner = useCallback(() => {
    setBannerVisible(false);
  }, []);

  const cadastroHref = useProductHref("/cadastrar?from=/tickets");
  const guestNavLinks = useMemo(
    () =>
      NAV_LINKS_GUEST.map((item) =>
        item.external ? { ...item, href: cadastroHref } : item,
      ),
    [cadastroHref],
  );

  /** Banner de instalar app: todas as telas exceto a home padrão (`/`). */
  const showInstallBanner = bannerHydrated && bannerVisible && !isHomePage;

  if (!ready) {
    // evita flicker entre "logado" e "deslogado" durante a hidratação
    return null;
  }

  if (isLoggedIn) {
    return (
      <HeaderShell showBanner={showInstallBanner} onDismissBanner={dismissBanner}>
        <div className="grid h-[86.5px] grid-cols-[48px_1fr_48px] items-center px-5 lg:hidden">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-start"
            aria-label="Abrir menu"
            onClick={openSidenav}
          >
            <MenuIcon className="h-6 w-6 text-white" strokeWidth={2.25} />
          </button>

          <Link href="/" className="flex items-center justify-center justify-self-center shrink-0" aria-label="Início">
            <Image
              src={logo}
              alt="Bolão do Milhão"
              width={168}
              height={44}
              quality={100}
              sizes="168px"
              priority
              className="h-[40px] w-auto"
            />
          </Link>

          <NotificationsBell variant="mobile" />
        </div>

        <div className="mx-auto hidden h-[80px] w-full max-w-[1500px] items-center justify-between px-8 lg:flex">
          <Link href="/" className="flex items-center shrink-0" aria-label="Início">
            <Image
              src={logo}
              alt="Bolão do Milhão"
              width={154}
              height={36}
              quality={100}
              sizes="154px"
              priority
              className="h-[34px] w-auto"
            />
          </Link>

          <div className="flex items-center gap-[24px]">
            <nav className="flex items-center gap-[24px]">
              {NAV_LINKS_LOGGED.map(({ label, href }) => {
                const baseHref = href.split("?")[0] ?? href;
                const isActive =
                  baseHref === "/"
                    ? pathname === "/"
                    : label === "Ranking"
                      ? pathname.startsWith("/ranking")
                      : label === "Palpites"
                        ? pathname.startsWith("/meus-palpites") || pathname.startsWith("/palpites")
                        : pathname === baseHref || pathname.startsWith(`${baseHref}/`);

                return (
                  <Link
                    key={label}
                    href={href}
                    className="text-[13px] font-medium leading-none transition-colors hover:text-white"
                    style={{ color: isActive ? "#B1EB0B" : "rgba(255,255,255,0.52)" }}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            <NotificationsBell variant="desktop" />

            <Link
              href="/tickets"
              className="flex h-[36px] min-w-[144px] items-center justify-center rounded-[8px] px-6 text-[12px] font-black uppercase leading-none text-[#0E141B] transition-transform active:scale-[0.98]"
              style={{ background: "#B1EB0B", boxShadow: "0 0 14px rgba(177,235,11,0.22)" }}
            >
              Comprar Ticket
            </Link>
          </div>
        </div>
      </HeaderShell>
    );
  }

  const hideOnMobileGuestHome = (pathname ?? "") === "/";

  return (
    <HeaderShell showBanner={showInstallBanner} onDismissBanner={dismissBanner}>
      <div
        className={[
          "w-full grid-cols-[48px_1fr_48px] items-center px-5 lg:justify-between lg:px-20 h-[86.5px]",
          hideOnMobileGuestHome ? "hidden lg:flex" : "grid lg:flex",
        ].join(" ")}
      >
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-start lg:hidden"
          aria-label="Abrir menu"
          onClick={openSidenav}
        >
          <MenuIcon className="h-6 w-6 text-white" strokeWidth={2.25} />
        </button>

        <Link href="/" className="flex items-center justify-center justify-self-center shrink-0 lg:justify-self-auto" aria-label="Início">
          <Image
            src={logo}
            alt="Bolão do Milhão"
            width={168}
            height={44}
            quality={100}
            sizes="(max-width: 1023px) 168px, 106px"
            priority
            className="h-[40px] w-auto lg:h-11"
          />
        </Link>

        <div className="h-10 w-10 lg:hidden" aria-hidden="true" />

        <nav className="hidden lg:flex items-center gap-7">
          {guestNavLinks.map(({ label, href }, index) => (
            <div key={label} className="flex items-center gap-7">
              {index === 3 && <span className="h-3 w-px bg-white/42" aria-hidden="true" />}
              <Link
                href={href}
                className="text-[18px] font-normal leading-none text-white/72 transition-colors hover:text-white"
              >
                {label}
              </Link>
            </div>
          ))}
        </nav>
      </div>
    </HeaderShell>
  );
}
