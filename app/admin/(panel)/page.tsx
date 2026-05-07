import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { getAdminDashboardStats } from "@/lib/admin/users";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();
  const cards = [
    { label: "Usuários", value: stats.usersCount.toLocaleString("pt-BR") },
    { label: "Admins", value: stats.adminsCount.toLocaleString("pt-BR") },
    { label: "Tickets pagos", value: stats.paidTicketsCount.toLocaleString("pt-BR") },
    { label: "Receita confirmada", value: formatBRL(stats.revenueCents) },
  ];

  return (
    <>
      <AdminPageTitle title="Dashboard" subtitle="Visão geral segura da operação do Bolão do Milhão." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[18px] border border-white/8 bg-[#101010] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">{card.label}</p>
            <p className="mt-4 text-[30px] font-black leading-none tracking-[-0.05em] text-primary">{card.value}</p>
          </article>
        ))}
      </div>
    </>
  );
}
