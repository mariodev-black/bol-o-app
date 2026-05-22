import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { formatAdminBRL } from "@/lib/admin/format";
import { getAdminTransactionStats, listAdminTransactions } from "@/lib/admin/sections";
import { AdminTransactionsClient } from "./AdminTransactionsClient";

export default async function AdminTransactionsPage() {
  const [stats, transactions] = await Promise.all([
    getAdminTransactionStats(),
    listAdminTransactions(),
  ]);
  const cards = [
    { label: "Transações", value: stats.totalCount.toLocaleString("pt-BR") },
    { label: "Pagas", value: stats.paidCount.toLocaleString("pt-BR") },
    { label: "Pendentes", value: stats.pendingCount.toLocaleString("pt-BR") },
    { label: "Receita paga", value: formatAdminBRL(stats.paidAmountCents) },
  ];

  return (
    <>
      <AdminPageTitle title="Transações" subtitle="Acompanhe todas as cobranças PIX, status e vínculos com usuários e cotas." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/80">{card.label}</p>
            <p className="mt-3 text-[24px] font-black leading-none text-primary">{card.value}</p>
          </article>
        ))}
      </div>

      <AdminTransactionsClient transactions={transactions} />
    </>
  );
}
