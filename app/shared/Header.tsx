"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import logo from "@/app/assets/logo.png";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Bolões", href: "/boloes" },
  { label: "Ranking", href: "/ranking" },
  { label: "Indique e ganhe", href: "/indique" },
  { label: "Regulamento", href: "/regulamento" },
  { label: "Termos", href: "/termos" },
];

export function Header() {
  const pathname = usePathname();

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
                ? pathname.startsWith("/boloes") || pathname.startsWith("/palpites")
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
