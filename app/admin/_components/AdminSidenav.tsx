"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ClipboardList, CreditCard, Handshake, Settings, Ticket, Users } from "lucide-react";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/users", label: "Usuários", icon: Users },
  { href: "/admin/affiliates", label: "Afiliados", icon: Handshake },
  { href: "/admin/palpites", label: "Palpites", icon: ClipboardList },
  { href: "/admin/cotas", label: "Cotas", icon: Ticket },
  { href: "/admin/transactions", label: "Transações", icon: CreditCard },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidenav() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const activePath = optimisticHref ?? pathname;

  useEffect(() => {
    setOptimisticHref(null);
  }, [pathname]);

  useEffect(() => {
    for (const item of NAV) router.prefetch(item.href);
  }, [router]);

  return (
    <nav className="flex flex-1 flex-col gap-1.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(activePath, href);
        return (
          <Link
            key={href}
            href={href}
            prefetch
            onClick={() => {
              setOptimisticHref(href);
              router.prefetch(href);
            }}
            onPointerEnter={() => router.prefetch(href)}
            onFocus={() => router.prefetch(href)}
            aria-current={active ? "page" : undefined}
            className={[
              "group relative flex items-center gap-3 rounded-[12px] px-3.5 py-3 text-[13px] font-bold transition-all duration-200",
              "hover:bg-white/5 hover:text-white",
              active
                ? "bg-white/7 text-white"
                : "text-white/48",
            ].join(" ")}
          >
            <span
              className={[
                "absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-primary transition-all duration-200",
                active ? "opacity-100" : "opacity-0",
              ].join(" ")}
            />
            <Icon className={["h-[17px] w-[17px] transition-colors", active ? "text-primary" : "text-white/38 group-hover:text-white/70"].join(" ")} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
