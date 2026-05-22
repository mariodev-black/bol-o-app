import { AdminInfoCard } from "@/app/admin/_components/AdminInfoCard";
import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { formatAdminBRL } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminUserDetail } from "@/lib/admin/users";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminUserDetailTabs } from "./AdminUserDetailTabs";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const admin = await requireAdmin();
  const user = await getAdminUserDetail(userId);
  if (!user) notFound();

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-5 inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-[11px] font-black uppercase tracking-[0.12em] text-white/72 transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary sm:px-4 sm:text-[12px] sm:tracking-[0.14em]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        Voltar para usuários
      </Link>
      <AdminPageTitle title={user.name ?? "Usuário sem nome"} subtitle="Detalhes completos do cadastro, cotas, pagamentos, palpites e afiliados." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <AdminInfoCard label="Cotas totais" value={user.ticketsCount.toLocaleString("pt-BR")} />
        <AdminInfoCard label="Cotas pagas" value={user.paidTicketsCount.toLocaleString("pt-BR")} />
        <AdminInfoCard label="Palpites" value={user.predictionsCount.toLocaleString("pt-BR")} />
        <AdminInfoCard label="Receita paga" value={formatAdminBRL(user.revenueCents)} />
      </div>

      <AdminUserDetailTabs
        user={user}
        canManageRole={admin.role === "super_admin"}
        canManageInfluencer={admin.role === "super_admin"}
      />
    </>
  );
}
