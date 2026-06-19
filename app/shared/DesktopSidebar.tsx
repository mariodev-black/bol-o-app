"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  BookOpen,
  Gift,
  HelpCircle,
  Home,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import type { StaticImageData } from "next/image";
import iconBrasileirao from "@/app/assets/icon-brasileirao2.png";
import iconPremier from "@/app/assets/icon-premiere2.png";
import iconChampions from "@/app/assets/ucl-logo.png";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import iconLaLiga from "@/app/assets/icon-laliga2.png";

const GREEN = "#B1EB0B";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ElementType;
  matchFn?: (path: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Início",
    Icon: Home,
    matchFn: (p) => p === "/",
  },
  {
    href: "/boloes",
    label: "Palpites",
    Icon: Target,
    matchFn: (p) => p.startsWith("/boloes") || p.startsWith("/palpites"),
  },
  {
    href: "/ranking",
    label: "Ranking",
    Icon: BarChart2,
    matchFn: (p) => p.startsWith("/ranking"),
  },
  {
    href: "/indique",
    label: "Indicar e Ganhar",
    Icon: Users,
    matchFn: (p) => p.startsWith("/indique"),
  },
  {
    href: "/premiacao",
    label: "Premiações",
    Icon: Gift,
    matchFn: (p) => p.startsWith("/premiacao"),
  },
  {
    href: "/regulamento",
    label: "Regras",
    Icon: BookOpen,
    matchFn: (p) => p.startsWith("/regulamento"),
  },
  {
    href: "/ajuda",
    label: "Central de Ajuda",
    Icon: HelpCircle,
    matchFn: (p) => p.startsWith("/ajuda"),
  },
];

type Campeonato = {
  href: string;
  label: string;
  logo: StaticImageData;
  hot?: boolean;
};

const CAMPEONATOS: Campeonato[] = [
  { href: "/tickets?bolao=extra", label: "Brasileirão", logo: iconBrasileirao, hot: true },
  { href: "/tickets?bolao=extra", label: "Premier League", logo: iconPremier },
  { href: "/tickets?bolao=extra", label: "Champions League", logo: iconChampions },
  { href: "/tickets?bolao=extra", label: "Copa do Brasil", logo: iconCopaBrasil },
  { href: "/tickets?bolao=extra", label: "La Liga", logo: iconLaLiga },
];

export function DesktopSidebar({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "";

  return (
    <div
      className={`flex flex-col overflow-y-auto px-2.5 py-4 ${className}`}
      style={{ background: "#040404", borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Navegação principal */}
      <nav aria-label="Navegação principal">
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.matchFn ? item.matchFn(pathname) : pathname === item.href;
            const { Icon } = item;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold transition-colors"
                style={{
                  background: active ? "rgba(177,235,11,0.12)" : undefined,
                  color: active ? GREEN : "rgba(255,255,255,0.68)",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "";
                }}
              >
                <Icon
                  className="size-[17px] shrink-0"
                  strokeWidth={active ? 2.5 : 2}
                  style={{ color: active ? GREEN : "rgba(255,255,255,0.50)" }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Campeonatos */}
      <div className="mt-5">
        <p
          className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.15em]"
          style={{ color: "rgba(255,255,255,0.28)" }}
        >
          CAMPEONATOS
        </p>
        <div className="flex flex-col gap-0.5">
          {CAMPEONATOS.map(({ href, label, logo, hot }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[12.5px] font-medium transition-colors"
              style={{ color: "rgba(255,255,255,0.58)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.color = "rgba(255,255,255,0.88)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "";
                e.currentTarget.style.color = "rgba(255,255,255,0.58)";
              }}
            >
              <Image
                src={logo}
                alt=""
                width={20}
                height={20}
                className="size-5 shrink-0 rounded object-contain"
                draggable={false}
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {hot ? <span className="shrink-0 text-[11px] leading-none">🔥</span> : null}
            </Link>
          ))}
          <Link
            href="/tickets?bolao=extra"
            className="px-3 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-90"
            style={{ color: "rgba(255,255,255,0.36)" }}
          >
            Ver todos →
          </Link>
        </div>
      </div>

      {/* SEJA UM CAMPEÃO */}
      <div className="mt-5">
        <div
          className="rounded-[14px] px-3 pb-4 pt-3 text-center"
          style={{
            background: "rgba(177,235,11,0.05)",
            border: "1px solid rgba(177,235,11,0.14)",
          }}
        >
          <Trophy className="mx-auto size-7" style={{ color: "#FFD700" }} strokeWidth={1.8} aria-hidden />
          <p className="mt-1.5 text-[12px] font-black uppercase leading-tight tracking-tight text-white">
            SEJA UM CAMPEÃO
          </p>
          <p className="mt-1.5 text-[11px] font-medium leading-snug" style={{ color: "rgba(255,255,255,0.52)" }}>
            Concorra a prêmios incríveis e mostre que você entende de futebol!
          </p>
          <Link
            href="/premiacao"
            className="mt-3 flex h-8 w-full items-center justify-center rounded-[8px] text-[10px] font-black uppercase tracking-wide transition hover:brightness-110 active:scale-[0.98]"
            style={{ background: GREEN, color: "#0E141B" }}
          >
            VER PREMIAÇÕES
          </Link>
        </div>
      </div>
    </div>
  );
}
