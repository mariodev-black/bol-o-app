import Link from "next/link";
import Image from "next/image";
import logo from "@/app/assets/logo.svg";
import type { AdminUser } from "@/lib/admin/auth";
import { AdminLogoutButton } from "@/app/admin/_components/AdminLogoutButton";
import { AdminMobileMenu } from "@/app/admin/_components/AdminMobileMenu";
import { AdminSidenav } from "@/app/admin/_components/AdminSidenav";

export { AdminPageTitle } from "@/app/admin/_components/AdminPageTitle";

export function AdminShell({ admin, children }: { admin: AdminUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-[280px] border-r border-white/8 bg-[#050505] px-6 py-7 lg:flex lg:flex-col">
        <Link href="/admin" className="mb-10 inline-flex items-center">
          <Image src={logo} alt="Bolão do Milhão" width={162} height={39} className="h-auto w-[162px]" priority />
        </Link>
        <div>
          <p className="mb-4 text-[12px] font-black uppercase tracking-[0.24em] text-white/22">Menu</p>
          <AdminSidenav />
        </div>
        <div className="mt-auto space-y-4 border-t border-white/8 pt-5">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-primary">Admin</p>
            <p className="mt-2 truncate text-[14px] font-bold text-white/88">{admin.name ?? admin.email}</p>
            <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.16em] text-white/28">{admin.role}</p>
          </div>
          <AdminLogoutButton />
        </div>
      </aside>

      <main className="min-h-screen px-3 pb-[max(3rem,env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pt-5 lg:ml-[280px] lg:px-8 lg:pt-8">
        <div className="mx-auto w-full min-w-0 max-w-[1180px]">
          <AdminMobileMenu admin={admin} />
          {children}
        </div>
      </main>
    </div>
  );
}
