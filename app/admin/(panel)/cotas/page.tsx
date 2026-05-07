import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { listAdminTickets } from "@/lib/admin/sections";
import { AdminCotasClient } from "./AdminCotasClient";

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
      <AdminCotasClient tickets={tickets} />
    </>
  );
}
