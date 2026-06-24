import type { AdminTicketDetail } from "@/lib/admin/sections";
import { AdminCotaPredictionsTable } from "./AdminCotaPredictionsTable";

export function AdminCotaPredictionsSection({
  ticket,
}: {
  ticket: AdminTicketDetail;
}) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
      <div className="border-b border-white/8 px-5 py-4">
        <h2 className="text-[15px] font-black text-white">Jogos desta cota</h2>
        <p className="mt-1 text-[12px] font-medium text-white/38">
          Todos os jogos do escopo do bolão, incluindo os sem palpite. Edite e salve para recalcular pontos
          automaticamente.
        </p>
      </div>
      <AdminCotaPredictionsTable ticketId={ticket.id} initialPredictions={ticket.predictions} />
    </section>
  );
}
