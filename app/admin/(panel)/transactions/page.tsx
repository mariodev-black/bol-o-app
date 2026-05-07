import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { formatAdminTicketType } from "@/lib/admin/format";
import { getAdminTransactionStats, listAdminTransactions } from "@/lib/admin/sections";
import Link from "next/link";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "approved") return "Pago";
  if (["pending_payment", "pending", "creating", "waiting_payment"].includes(normalized)) return "Pendente";
  if (["failed", "canceled", "cancelled", "refused", "expired"].includes(normalized)) return "Falhou";
  return status || "Nao informado";
}

function statusClassName(status: string) {
  const label = statusLabel(status);
  if (label === "Pago") return "border-primary/20 bg-primary/10 text-primary";
  if (label === "Pendente") return "border-orange-400/25 bg-orange-400/10 text-orange-200";
  if (label === "Falhou") return "border-red-400/25 bg-red-400/10 text-red-200";
  return "border-white/10 bg-white/5 text-white/55";
}

export default async function AdminTransactionsPage() {
  const [stats, transactions] = await Promise.all([
    getAdminTransactionStats(),
    listAdminTransactions(),
  ]);
  const cards = [
    { label: "Transações", value: stats.totalCount.toLocaleString("pt-BR") },
    { label: "Pagas", value: stats.paidCount.toLocaleString("pt-BR") },
    { label: "Pendentes", value: stats.pendingCount.toLocaleString("pt-BR") },
    { label: "Receita paga", value: formatBRL(stats.paidAmountCents) },
  ];

  return (
    <>
      <AdminPageTitle title="Transações" subtitle="Acompanhe todas as cobranças PIX, status e vínculos com usuários e cotas." />
      <div className="mb-5 grid gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{card.label}</p>
            <p className="mt-3 text-[24px] font-black leading-none text-primary">{card.value}</p>
          </article>
        ))}
      </div>

      <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left">
            <thead className="border-b border-white/8 bg-white/2.5">
              <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                <th className="px-4 py-4">Transação</th>
                <th className="px-4 py-4">Usuário</th>
                <th className="px-4 py-4">Cota</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Valor</th>
                <th className="px-4 py-4">Método</th>
                <th className="px-4 py-4">Criada em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="text-[13px] text-white/72 transition-colors hover:bg-white/2.5">
                  <td className="px-4 py-4">
                    <p className="font-mono text-[11px] text-white/50">{transaction.id}</p>
                    {transaction.providerTransactionId ? (
                      <p className="mt-1 font-mono text-[10px] text-white/25">{transaction.providerTransactionId}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/admin/users/${transaction.userId}`} className="block">
                      <p className="font-bold text-white hover:text-primary">{transaction.userName ?? "Sem nome"}</p>
                      <p className="mt-1 text-white/35">{transaction.userEmail}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    {transaction.ticketId ? (
                      <Link href={`/admin/cotas/${transaction.ticketId}`} className="block">
                        <p className="font-mono text-[11px] text-white/45 hover:text-primary">{transaction.ticketId}</p>
                        <p className="mt-1 font-bold uppercase text-white/35">{formatAdminTicketType(transaction.ticketType)}</p>
                      </Link>
                    ) : (
                      <span className="text-white/30">Sem cota</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${statusClassName(transaction.status)}`}>
                      {statusLabel(transaction.status)}
                    </span>
                    <p className="mt-1 text-[10px] text-white/25">{transaction.status}</p>
                  </td>
                  <td className="px-4 py-4 font-black text-white">{formatBRL(transaction.amountCents)}</td>
                  <td className="px-4 py-4">
                    <p className="font-bold uppercase text-white/58">{transaction.paymentMethod}</p>
                    <p className="mt-1 text-white/30">{transaction.provider}</p>
                  </td>
                  <td className="px-4 py-4 text-white/45">{formatDate(transaction.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
