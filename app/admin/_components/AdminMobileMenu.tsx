"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import logo from "@/app/assets/logo.svg";
import type { AdminUser } from "@/lib/admin/auth";
import { ADMIN_NAV, isAdminNavActive } from "@/app/admin/_components/admin-nav";
import { AdminLogoutButton } from "@/app/admin/_components/AdminLogoutButton";

export function AdminMobileMenu({ admin }: { admin: AdminUser }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const activePath = optimisticHref ?? pathname;

  useEffect(() => {
    setOptimisticHref(null);
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    for (const item of ADMIN_NAV) router.prefetch(item.href);
  }, [router]);

  return (
    <>
      <header className="sticky top-0 z-50 -mx-3 mb-5 flex items-center justify-between gap-2 border-b border-white/8 bg-black/95 px-3 py-3 backdrop-blur-md sm:-mx-4 sm:mb-6 sm:gap-3 sm:rounded-[18px] sm:border sm:px-4 sm:py-4 lg:static lg:mx-0 lg:hidden lg:border-white/8 lg:bg-[#0D0D0D] [padding-top:max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/admin" className="min-w-0 shrink" onClick={() => setOpen(false)}>
          <Image
            src={logo}
            alt="Bolão do Milhão"
            width={150}
            height={36}
            className="h-auto w-[min(130px,36vw)] max-w-[150px] sm:w-[150px]"
            priority
          />
        </Link>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase text-[#0E141B] sm:px-3 sm:text-[11px]">
            Admin
          </span>
          <button
            type="button"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/5 text-white"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu administrativo">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(100%,320px)] flex-col border-l border-white/10 bg-[#050505] px-5 py-6 shadow-[-12px_0_40px_rgba(0,0,0,0.55)]">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-[12px] font-black uppercase tracking-[0.24em] text-white/22">Menu</p>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
              {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
                const active = isAdminNavActive(activePath, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch
                    onClick={() => {
                      setOptimisticHref(href);
                      setOpen(false);
                      router.prefetch(href);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex items-center gap-3 rounded-[12px] px-3.5 py-3 text-[13px] font-bold transition-colors",
                      active ? "bg-white/7 text-white" : "text-white/48 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    <Icon className={["h-[17px] w-[17px]", active ? "text-primary" : "text-white/38"].join(" ")} strokeWidth={2} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-white/8 pt-5">
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-primary">Admin</p>
              <p className="mt-2 truncate text-[14px] font-bold text-white/88">{admin.name ?? admin.email}</p>
              <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.16em] text-white/28">{admin.role}</p>
              <div className="mt-4">
                <AdminLogoutButton onDone={() => setOpen(false)} />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
