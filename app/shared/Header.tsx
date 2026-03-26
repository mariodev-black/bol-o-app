"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import logo from "@/app/assets/logo.png";
import { Bell, Menu as MenuIcon } from "lucide-react";
import { useAuth } from "@/app/shared/AuthContext";
import { useSidenav } from "@/app/shared/SidenavContext";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Bolões", href: "/boloes" },
  { label: "Ranking", href: "/ranking" },
  { label: "Indique e ganhe", href: "/indique" },
  { label: "Regulamento", href: "/regulamento" },
  { label: "Termos", href: "/termos" },
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
        className="fixed top-0 left-0 right-0 z-50 w-full flex items-center justify-between px-5 lg:px-10 h-16"
        style={{ backgroundColor: "#060B18" }}
      >
        <Link href="/" className="flex items-center shrink-0" aria-label="Início">
          <Image src={logo} alt="Bolão do Milhão" height={44} priority />
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
                className="text-sm font-semibold transition-colors hover:text-white"
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

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 w-full flex items-center justify-between px-6 lg:px-10 h-16"
      style={{ backgroundColor: "#060B18" }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center shrink-0" aria-label="Início">
        <Image src={logo} alt="Bolão do Milhão" height={44} priority />
      </Link>

      {/* Nav central — apenas desktop */}
      <nav className="hidden lg:flex items-center gap-8">
        {NAV_LINKS.map(({ label, href }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : href === "/boloes"
                ? pathname.startsWith("/boloes") || pathname.startsWith("/palpites") || pathname.startsWith("/meus-palpites")
                : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              className="text-sm font-medium transition-colors hover:text-white"
              style={{ color: isActive ? "#D4AF37" : "rgba(255,255,255,0.55)" }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Direita — botões colados com inclinação */}
      <div
        className="flex items-stretch h-10 rounded-[14px] overflow-hidden"
        style={{ border: "1px solid rgba(218,182,130,0.3)" }}
      >
        {/* Registre-se */}
        <Link
          href="/cadastrar"
          className="flex items-center gap-2 pl-5 pr-5 font-bold text-sm relative z-10 whitespace-nowrap"
          style={{
            background: "linear-gradient(135deg, #D4AF37 0%, #F5E6A5 100%)",
            color: "#0E141B",
            clipPath: "polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%)",
          }}
        >
          Registre-se
        </Link>

        {/* Entrar */}
        <Link
          href="/login"
          className="flex items-center px-5 font-bold text-sm -ml-4 relative z-20 whitespace-nowrap"
          style={{
            background: "#060B18",
            color: "#DAB682",
            clipPath: "polygon(16px 0, 100% 0, 100% 100%, 0 100%)",
          }}
        >
          Entrar
        </Link>
      </div>
    </header>
  );
}
