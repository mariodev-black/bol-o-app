import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { listAdminTickets } from "@/lib/admin/sections";
import { AdminCotasClient } from "./AdminCotasClient";

function cotaUsageStatus(ticket: Awaited<ReturnType<typeof listAdminTickets>>[number]) {
  if (ticket.predictionsCount <= 0) return "Disponível";
  if (ticket.pendingPredictionsCount > 0) return "Em uso";
  return "Finalizada";
}

export default async function AdminCotasPage() {
  const tickets = await listAdminTickets();
  const paidTickets = tickets.length;
  const availableTickets = tickets.filter((ticket) => cotaUsageStatus(ticket) === "Disponível").length;
  const inUseTickets = tickets.filter((ticket) => cotaUsageStatus(ticket) === "Em uso").length;
  const finishedTickets = tickets.filter((ticket) => cotaUsageStatus(ticket) === "Finalizada").length;

  return (
    <>
      <AdminPageTitle title="Cotas" subtitle="Lista operacional apenas das cotas pagas, com uso, pontuação e ranking." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {[
          { label: "Cotas pagas", value: paidTickets.toLocaleString("pt-BR") },
          { label: "Disponíveis", value: availableTickets.toLocaleString("pt-BR") },
          { label: "Em uso", value: inUseTickets.toLocaleString("pt-BR") },
          { label: "Finalizadas", value: finishedTickets.toLocaleString("pt-BR") },
        ].map((card) => (
          <article key={card.label} className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/80">{card.label}</p>
            <p className="mt-3 text-[24px] font-black leading-none text-primary">{card.value}</p>
          </article>
        ))}
      </div>
      <AdminCotasClient tickets={tickets} />
    </>
  );
}
