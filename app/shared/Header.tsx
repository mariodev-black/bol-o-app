"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProductHref } from "@/app/shared/useProductHref";
import logo from "@/app/assets/logo.svg";
import { Menu as MenuIcon, LogOut, User } from "lucide-react";
import { NotificationsBell } from "@/app/shared/NotificationsBell";
import { PromotionsGiftButton } from "@/app/shared/PromotionsGiftButton";
import { useHomeAuthModal } from "@/app/shared/HomeAuthModalContext";
import { useAuth } from "@/app/shared/AuthContext";
import { useSidenav } from "@/app/shared/SidenavContext";
import { InstallAppBanner } from "@/app/shared/InstallAppBanner";
import {
  HEADER_MAIN_HEIGHT_DESKTOP_PX,
  HEADER_MAIN_HEIGHT_MOBILE_PX,
  readInstallBannerDismissed,
  syncAppHeaderHeightCss,
} from "@/app/shared/install-app-banner";
import { useStandalonePwa } from "@/app/shared/useStandalonePwa";
import { getAvatarPresetImage } from "@/lib/user/avatar-presets";

const NAV_LINKS_GUEST = [
  { label: "Como funciona?", href: "/#como-funciona", external: false },
  { label: "Sistema de pontos", href: "/#sistema-pontos", external: false },
  { label: "Cotas", href: "/#cotas", external: false },
  { label: "Criar conta gratuitamente", href: "/cadastrar?from=/tickets", external: true },
] as const;

const NAV_LINKS_LOGGED = [
  { label: "Home", href: "/" },
  { label: "Palpites", href: "/meus-palpites" },
  { label: "Palpites da Galera", href: "/palpites-jogadores" },
  { label: "Ranking", href: "/ranking" },
  { label: "Premiação", href: "/premiacao" },
  { label: "Indique e ganhe", href: "/indique" },
  { label: "Regulamento", href: "/privacidade" },
];

function UserAvatar({
  userId,
  avatarIndex,
  avatarUploadFilename,
  size = 36,
}: {
  userId: string;
  avatarIndex: number;
  avatarUploadFilename: string | null;
  size?: number;
}) {
  if (avatarUploadFilename) {
    const src = `/api/public/avatar/${encodeURIComponent(userId)}?v=${encodeURIComponent(avatarUploadFilename)}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-full object-cover" />
    );
  }
  return (
    <Image
      src={getAvatarPresetImage(avatarIndex)}
      alt=""
      fill
      className="object-cover"
      sizes={`${size}px`}
    />
  );
}

function UserMenuDesktop() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.push("/login");
  };

  if (!user) return null;

  const displayName = user.nickname ?? user.name ?? user.email;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative size-[38px] shrink-0 overflow-hidden rounded-full ring-2 ring-white/15 transition hover:ring-primary/60 focus:outline-none"
        aria-label="Menu do usuário"
        aria-expanded={open}
      >
        <UserAvatar
          userId={user.id}
          avatarIndex={user.avatarIndex}
          avatarUploadFilename={user.avatarUploadFilename}
          size={38}
        />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+10px)] z-[200] w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3.5">
            <div className="relative size-9 shrink-0 overflow-hidden rounded-full">
              <UserAvatar
                userId={user.id}
                avatarIndex={user.avatarIndex}
                avatarUploadFilename={user.avatarUploadFilename}
                size={36}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-white">{displayName}</p>
              <p className="truncate text-[11px] text-white/45">{user.email}</p>
            </div>
          </div>

          <div className="py-1">
            <Link
              href="/perfil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-white/75 transition hover:bg-white/[0.06] hover:text-white"
            >
              <User className="size-4 shrink-0" strokeWidth={2} />
              Perfil
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-red-400/80 transition hover:bg-white/[0.06] hover:text-red-400"
            >
              <LogOut className="size-4 shrink-0" strokeWidth={2} />
              Sair
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderShell({
  showInstallBanner,
  onDismissInstallBanner,
  children,
}: {
  showInstallBanner: boolean;
  onDismissInstallBanner: () => void;
  children: React.ReactNode;
}) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 w-full bg-black"
      style={{ backgroundColor: "#000000" }}
    >
      {showInstallBanner ? (
        <InstallAppBanner onDismiss={onDismissInstallBanner} />
      ) : null}
      {children}
    </header>
  );
}

export function Header() {
  const pathname = usePathname();
  const { ready, isLoggedIn } = useAuth();
  const { openLogin, openCadastro } = useHomeAuthModal();
  const { openSidenav } = useSidenav();
  const [installBannerVisible, setInstallBannerVisible] = useState(false);
  const [installBannerHydrated, setInstallBannerHydrated] = useState(false);
  const isPwa = useStandalonePwa();

  useEffect(() => {
    setInstallBannerVisible(!readInstallBannerDismissed());
    setInstallBannerHydrated(true);
  }, []);

  const isHomePage = (pathname ?? "") === "/";
  const isGuestHomePromo = isHomePage && !isLoggedIn;

  useEffect(() => {
    if (!installBannerHydrated || !ready) return;

    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      const mainHeight = mq.matches
        ? HEADER_MAIN_HEIGHT_DESKTOP_PX
        : HEADER_MAIN_HEIGHT_MOBILE_PX;
      const showInstallBanner =
        installBannerVisible && !isHomePage && !isPwa;
      syncAppHeaderHeightCss(showInstallBanner, mainHeight);
    };

    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [
    installBannerVisible,
    installBannerHydrated,
    ready,
    isHomePage,
    isPwa,
  ]);

  const dismissInstallBanner = useCallback(() => {
    setInstallBannerVisible(false);
  }, []);

  const cadastroHref = useProductHref("/cadastrar?from=/tickets");
  const guestNavLinks = useMemo(
    () =>
      NAV_LINKS_GUEST.map((item) =>
        item.external ? { ...item, href: cadastroHref } : item,
      ),
    [cadastroHref],
  );

  /** Faixa “Instale o app”: só no navegador (não no PWA instalado), exceto home. */
  const showInstallBanner =
    installBannerHydrated && installBannerVisible && !isHomePage && !isPwa;

  if (!ready) {
    // evita flicker entre "logado" e "deslogado" durante a hidratação
    return null;
  }

  if (isLoggedIn) {
    return (
      <HeaderShell
        showInstallBanner={showInstallBanner}
        onDismissInstallBanner={dismissInstallBanner}
      >
        <div className="grid h-[var(--app-header-main-height,55px)] grid-cols-[40px_1fr_40px] items-center px-4 lg:hidden">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-start"
            aria-label="Abrir menu"
            onClick={openSidenav}
          >
            <MenuIcon className="h-5 w-5 text-white" strokeWidth={2.25} />
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
              className="h-[28px] w-auto"
            />
          </Link>

          <div className="flex items-center justify-end gap-0.5">
            <PromotionsGiftButton variant="mobile" />
            <NotificationsBell variant="mobile" />
          </div>
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
                      : label === "Palpites da Galera"
                        ? pathname.startsWith("/palpites-jogadores")
                        : label === "Palpites"
                          ? (pathname.startsWith("/meus-palpites") ||
                              pathname.startsWith("/palpites")) &&
                            !pathname.startsWith("/palpites-jogadores")
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

            <div className="flex items-center gap-1">
              <PromotionsGiftButton variant="desktop" />
              <NotificationsBell variant="desktop" />
            </div>

            <Link
              href="/tickets"
              className="flex h-[36px] min-w-[144px] items-center justify-center rounded-[8px] px-6 text-[12px] font-black uppercase leading-none text-[#0E141B] transition-transform active:scale-[0.98]"
              style={{ background: "#B1EB0B", boxShadow: "0 0 14px rgba(177,235,11,0.22)" }}
            >
              Comprar Ticket
            </Link>

            <UserMenuDesktop />
          </div>
        </div>
      </HeaderShell>
    );
  }

  if (isGuestHomePromo) {
    return (
      <HeaderShell
        showInstallBanner={showInstallBanner}
        onDismissInstallBanner={dismissInstallBanner}
      >
        <div className="mx-auto flex h-[var(--app-header-main-height,55px)] w-full max-w-[430px] items-center justify-between px-4 lg:h-[80px] lg:max-w-[1500px] lg:px-8">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Início">
            <Image
              src={logo}
              alt="Bolão do Milhão"
              width={168}
              height={44}
              quality={100}
              sizes="168px"
              priority
              className="h-[26px] w-auto lg:h-11"
            />
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => openLogin("/")}
              className="flex h-[34px] min-w-[78px] items-center justify-center rounded-[10px] border border-white bg-black px-3.5 text-[11px] font-bold uppercase leading-none tracking-[0.06em] text-white transition hover:bg-white/[0.06] active:scale-[0.98] lg:h-10 lg:min-w-[92px] lg:px-5 lg:text-[12px]"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => openCadastro("/")}
              className="flex h-[34px] min-w-[92px] items-center justify-center rounded-[10px] bg-[#B1EB0B] px-3.5 text-[11px] font-black uppercase leading-none tracking-[0.06em] text-[#0E141B] transition active:scale-[0.98] lg:h-10 lg:min-w-[108px] lg:px-5 lg:text-[12px]"
              style={{ boxShadow: "0 0 14px rgba(177,235,11,0.22)" }}
            >
              Cadastrar
            </button>
          </div>
        </div>
      </HeaderShell>
    );
  }

  const hideOnMobileGuestHome = false;

  return (
    <HeaderShell
      showInstallBanner={showInstallBanner}
      onDismissInstallBanner={dismissInstallBanner}
    >
      <div
        className={[
          "w-full grid-cols-[40px_1fr_40px] items-center px-4 lg:justify-between lg:px-20 h-[var(--app-header-main-height,55px)] lg:h-[80px]",
          hideOnMobileGuestHome ? "hidden lg:flex" : "grid lg:flex",
        ].join(" ")}
      >
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-start lg:hidden"
          aria-label="Abrir menu"
          onClick={openSidenav}
        >
          <MenuIcon className="h-5 w-5 text-white" strokeWidth={2.25} />
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
            className="h-[28px] w-auto lg:h-11"
          />
        </Link>

        <div className="h-9 w-9 lg:hidden" aria-hidden="true" />

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
