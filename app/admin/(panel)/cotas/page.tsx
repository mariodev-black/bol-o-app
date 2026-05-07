import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { formatAdminTicketType } from "@/lib/admin/format";
import { listAdminTickets } from "@/lib/admin/sections";
import Link from "next/link";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default async function AdminCotasPage() {
  const tickets = await listAdminTickets();
  const totalTickets = tickets.length;
  const paidTickets = tickets.filter((ticket) => ticket.status === "paid").length;
  const pendingPredictions = tickets.reduce((acc, ticket) => acc + ticket.pendingPredictionsCount, 0);
  const sentPredictions = tickets.reduce((acc, ticket) => acc + ticket.predictionsCount, 0);

  return (
    <>
      <AdminPageTitle title="Cotas" subtitle="Lista operacional das cotas, pagamentos e palpites por jogador." />
      <div className="mb-5 grid gap-4 md:grid-cols-4">
        {[
          { label: "Cotas listadas", value: totalTickets.toLocaleString("pt-BR") },
          { label: "Cotas pagas", value: paidTickets.toLocaleString("pt-BR") },
          { label: "Palpites enviados", value: sentPredictions.toLocaleString("pt-BR") },
          { label: "Palpites pendentes", value: pendingPredictions.toLocaleString("pt-BR") },
        ].map((card) => (
          <article key={card.label} className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{card.label}</p>
            <p className="mt-3 text-[24px] font-black leading-none text-primary">{card.value}</p>
          </article>
        ))}
      </div>
      <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left">
            <thead className="border-b border-white/8 bg-white/2.5">
              <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                <th className="px-4 py-4">Cota</th>
                <th className="px-4 py-4">Usuário</th>
                <th className="px-4 py-4">Tipo</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Qtd.</th>
                <th className="px-4 py-4">Valor</th>
                <th className="px-4 py-4">Palpites</th>
                <th className="px-4 py-4">Pendentes</th>
                <th className="px-4 py-4">Criada em</th>
                <th className="px-4 py-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="text-[13px] text-white/72 transition-colors hover:bg-white/2.5">
                  <td className="px-4 py-4">
                    <p className="font-mono text-[11px] text-white/45">{ticket.id}</p>
                    {ticket.externalRef ? <p className="mt-1 font-mono text-[10px] text-white/25">{ticket.externalRef}</p> : null}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-white">{ticket.userName ?? "Sem nome"}</p>
                    <p className="mt-1 text-white/35">{ticket.userEmail}</p>
                  </td>
                  <td className="px-4 py-4 font-bold uppercase text-white/58">{formatAdminTicketType(ticket.ticketType)}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase text-primary">
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-black text-white">{ticket.quantity}</td>
                  <td className="px-4 py-4 font-black text-white">{formatBRL(ticket.totalAmountCents)}</td>
                  <td className="px-4 py-4">
                    <p className="font-black text-white">
                      {ticket.predictionsCount}/{ticket.totalMatchesCount}
                    </p>
                    <p className="mt-1 text-[11px] text-white/35">enviados</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={[
                      "rounded-full px-3 py-1 text-[11px] font-black uppercase",
                      ticket.pendingPredictionsCount > 0
                        ? "border border-orange-400/25 bg-orange-400/10 text-orange-200"
                        : "border border-primary/20 bg-primary/10 text-primary",
                    ].join(" ")}>
                      {ticket.pendingPredictionsCount}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-white/45">
                    {new Intl.DateTimeFormat("pt-BR").format(new Date(ticket.createdAt))}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/cotas/${ticket.id}`}
                      className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/15"
                    >
                      Ver tudo
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
