"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import logo from "@/app/assets/logo.png";
import { Bell, Menu as MenuIcon } from "lucide-react";
import { useAuth } from "@/app/shared/AuthContext";
import { useSidenav } from "@/app/shared/SidenavContext";

const NAV_LINKS = [
  { label: "Como funciona?", href: "#como-funciona" },
  { label: "Sistema de pontos", href: "#sistema-de-pontos" },
  { label: "Cotas", href: "#cotas" },
  { label: "Criar conta gratuitamente", href: "/cadastrar" },
];

const NAV_LINKS_LOGGED = [
  { label: "Home", href: "/" },
  { label: "Bolões", href: "/boloes" },
  { label: "Meus Palpites", href: "/meus-palpites" },
  { label: "Tickets", href: "/tickets" },
  { label: "Perfil", href: "/perfil" },
];

export function Header() {
  const pathname = usePathname();
  const { ready, isLoggedIn } = useAuth();
  const { openSidenav } = useSidenav();

  if (!ready) {
    // evita flicker entre "logado" e "deslogado" durante a hidratação
    return null;
  }

  if (isLoggedIn) {
    return (
      <header
        className="fixed top-0 left-0 right-0 z-50 w-full flex items-center justify-between px-5 lg:px-10 h-[86.5px]"
        style={{ backgroundColor: "#000000" }}
      >
        <Link href="/" className="flex items-center shrink-0" aria-label="Início">
          <Image
            src={logo}
            alt="Bolão do Milhão"
            width={106}
            height={44}
            quality={100}
            sizes="106px"
            priority
            className="h-11 w-auto"
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {NAV_LINKS_LOGGED.map(({ label, href }) => {
            const baseHref = href.split("?")[0] ?? href;
            const isActive =
              baseHref === "/"
                ? pathname === "/"
                : baseHref === "/boloes"
                  ? pathname.startsWith("/boloes")
                  : baseHref === "/palpites" || baseHref === "/meus-palpites"
                    ? pathname.startsWith("/palpites") || pathname.startsWith("/meus-palpites")
                    : pathname === baseHref || pathname.startsWith(`${baseHref}/`);

            return (
              <Link
                key={label}
                href={href}
                className="text-sm font-medium transition-colors hover:text-white"
                style={{ color: isActive ? "#D4AF37" : "rgba(255,255,255,0.58)" }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {/* Notificações */}
          <button
            type="button"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: "#13181F",
            }}
            aria-label="Notificações"
          >
            <Bell className="w-5 h-5" style={{ color: "rgba(255,255,255,0.65)" }} strokeWidth={2} />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#FF3B3B",
                boxShadow: "0 0 0 3px rgba(255,59,59,0.12)",
              }}
            />
          </button>

          {/* Menu (sidenav) - a ação será conectada na camada acima */}
          <button
            type="button"
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            aria-label="Abrir menu"
            onClick={openSidenav}
          >
            <MenuIcon className="w-5 h-5" style={{ color: "rgba(255,255,255,0.65)" }} strokeWidth={2} />
          </button>
        </div>
      </header>
    );
  }

  const hideOnMobileGuestHome = (pathname ?? "") === "/";

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 w-full items-center justify-center lg:justify-between px-6 lg:px-20 h-[86.5px]",
        hideOnMobileGuestHome ? "hidden lg:flex" : "flex",
      ].join(" ")}
      style={{ backgroundColor: "#000000" }}
    >
      {/* Logo — centralizado no mobile sem login; à esquerda no lg */}
      <Link href="/" className="flex items-center shrink-0" aria-label="Início">
        <Image
          src={logo}
          alt="Bolão do Milhão"
          width={106}
          height={44}
          quality={100}
          sizes="106px"
          priority
          className="h-11 w-auto"
        />
      </Link>

      <nav className="hidden lg:flex items-center gap-7">
        {NAV_LINKS.map(({ label, href }, index) => (
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
    </header>
  );
}
