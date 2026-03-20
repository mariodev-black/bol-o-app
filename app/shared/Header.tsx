"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/app/(authenticated)/components/ui/button";
import logo from "@/app/assets/logo.png";

const NAV_LINKS = [
  { label: "Home",            href: "/" },
  { label: "Palpites",        href: "/palpites" },
  { label: "Ranking",         href: "/ranking" },
  { label: "Indique e ganhe", href: "/indique" },
  { label: "Regulamento",     href: "/regulamento" },
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
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              className="text-sm font-medium transition-colors hover:text-white"
              style={{ color: isActive ? "#FFAF2F" : "rgba(255,255,255,0.55)" }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Direita — sino + botão */}
      <div className="flex items-center gap-3">
        {/* Sino com badge e bg */}
        <button
          aria-label="Notificações"
          className="relative flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-white/15"
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.8)",
          }}
        >
          <Bell className="w-5 h-5" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: "#EF4444" }}
          />
        </button>

        {/* Botão Comprar Ticket */}
        <Button
          asChild
          className="rounded-full px-5 font-bold text-sm h-9 border-0"
          style={{
            background: "linear-gradient(90deg, #FFAF2F, #FFE8BA)",
            color: "#0E141B",
          }}
        >
          <Link href="/cadastrar">Comprar Ticket</Link>
        </Button>
      </div>
    </header>
  );
}
