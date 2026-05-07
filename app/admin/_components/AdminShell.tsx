import Link from "next/link";
import Image from "next/image";
import logo from "@/app/assets/logo.svg";
import type { AdminUser } from "@/lib/admin/auth";
import { AdminSidenav } from "@/app/admin/_components/AdminSidenav";

export function AdminShell({ admin, children }: { admin: AdminUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-[280px] border-r border-white/8 bg-[#050505] px-6 py-7 lg:flex lg:flex-col">
        <Link href="/admin" className="mb-10 inline-flex items-center">
          <Image src={logo} alt="Bolão do Milhão" width={162} height={39} className="h-auto w-[162px]" priority />
        </Link>
        <div>
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-white/22">Menu</p>
          <AdminSidenav />
        </div>
        <div className="mt-auto border-t border-white/8 pt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Admin</p>
          <p className="mt-2 truncate text-[14px] font-bold text-white/88">{admin.name ?? admin.email}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/28">{admin.role}</p>
        </div>
      </aside>

      <main className="min-h-screen px-4 pb-12 pt-5 lg:ml-[280px] lg:px-8 lg:pt-8">
        <div className="mx-auto w-full max-w-[1180px]">
          <header className="mb-6 flex items-center justify-between rounded-[18px] border border-white/8 bg-[#0D0D0D] px-4 py-4 lg:hidden">
            <Image src={logo} alt="Bolão do Milhão" width={150} height={36} className="h-auto w-[150px]" />
            <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase text-[#0E141B]">
              Admin
            </span>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}

export function AdminPageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-7">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">Painel administrativo</p>
      <h1 className="mt-2 text-[34px] font-black leading-none tracking-[-0.045em] text-white lg:text-[44px]">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] font-medium leading-relaxed text-white/45">{subtitle}</p>
    </div>
  );
}
