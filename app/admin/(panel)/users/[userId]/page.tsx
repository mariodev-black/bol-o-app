import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminUserDetail } from "@/lib/admin/users";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminUserDetailTabs } from "./AdminUserDetailTabs";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/80">{label}</p>
      <div className="mt-3 text-[14px] font-bold text-white/82">{value}</div>
    </article>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [admin, user] = await Promise.all([
    requireAdmin(),
    getAdminUserDetail(userId),
  ]);
  if (!user) notFound();

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-5 inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-[12px] font-black uppercase tracking-[0.14em] text-white/72 transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        Voltar para usuários
      </Link>
      <AdminPageTitle title={user.name ?? "Usuário sem nome"} subtitle="Detalhes completos do cadastro, cotas, pagamentos, palpites e afiliados." />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <InfoCard label="Cotas totais" value={user.ticketsCount.toLocaleString("pt-BR")} />
        <InfoCard label="Cotas pagas" value={user.paidTicketsCount.toLocaleString("pt-BR")} />
        <InfoCard label="Palpites" value={user.predictionsCount.toLocaleString("pt-BR")} />
        <InfoCard label="Receita paga" value={formatBRL(user.revenueCents)} />
      </div>

      <AdminUserDetailTabs
        user={user}
        canManageRole={admin.role === "super_admin"}
        canManageInfluencer={admin.role === "super_admin"}
      />
    </>
  );
}
