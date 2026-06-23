import { AdminInfoCard } from "@/app/admin/_components/AdminInfoCard";
import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import {
  formatAdminBRLNullable,
  formatAdminDateTime,
  formatAdminTicketType,
  maskAdminCpf,
} from "@/lib/admin/format";
import { getAdminTicketDetail } from "@/lib/admin/sections";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCotaPredictionsTable } from "./AdminCotaPredictionsTable";

function formatPredictionsSent(count: number, total: number) {
  if (total > 0) {
    return `${count.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}`;
  }
  return count.toLocaleString("pt-BR");
}

function formatCotaStatus(status: string | null) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "paid" || normalized === "approved") return "Paga";
  if (["pending_payment", "pending", "creating", "waiting_payment"].includes(normalized)) return "Pendente";
  if (["failed", "canceled", "cancelled", "refused", "expired"].includes(normalized)) return "Falhou";
  return status || "Não informado";
}

function cotaUsageStatus(ticket: {
  predictionsCount: number;
  pendingPredictionsCount: number;
}) {
  if (ticket.predictionsCount <= 0) return "Disponível";
  if (ticket.pendingPredictionsCount > 0) return "Em uso";
  return "Finalizada";
}

export default async function AdminCotaDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const ticket = await getAdminTicketDetail(ticketId);
  if (!ticket) notFound();

  return (
    <>
      <Link
        href="/admin/cotas"
        className="mb-5 inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-[12px] font-black uppercase tracking-[0.14em] text-white/72 transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        Voltar para cotas
      </Link>
      <AdminPageTitle title="Detalhes da cota" subtitle="Visao completa do jogador, pagamento e palpites desta cota." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <AdminInfoCard label="Pontuação" value={<span className="text-primary">{ticket.scorePoints.toLocaleString("pt-BR")} pts</span>} />
        <AdminInfoCard label="Ranking modalidade" value={ticket.rankingPosition ? <span className="text-primary">#{ticket.rankingPosition}</span> : "Sem posição"} />
        <AdminInfoCard label="Palpites enviados" value={formatPredictionsSent(ticket.predictionsCount, ticket.totalMatchesCount)} />
        <AdminInfoCard label="Palpites pendentes" value={ticket.pendingPredictionsCount.toLocaleString("pt-BR")} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <AdminInfoCard label="Status da cota" value={<span className="uppercase text-primary">{cotaUsageStatus(ticket)}</span>} />
        <AdminInfoCard label="Valor da cota" value={formatAdminBRLNullable(ticket.totalAmountCents)} />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <section className="rounded-[18px] border border-white/8 bg-[#101010] p-5">
          <h2 className="text-[15px] font-black text-white">Dados da cota</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AdminInfoCard label="ID" value={<span className="font-mono text-[11px]">{ticket.id}</span>} />
            <AdminInfoCard label="Referencia" value={<span className="font-mono text-[11px]">{ticket.externalRef ?? "Não informado"}</span>} />
            <AdminInfoCard label="Tipo" value={<span className="uppercase">{formatAdminTicketType(ticket.ticketType)}</span>} />
            <AdminInfoCard label="Quantidade" value={ticket.quantity.toLocaleString("pt-BR")} />
            <AdminInfoCard label="Preço unitário" value={formatAdminBRLNullable(ticket.unitPriceCents)} />
            <AdminInfoCard label="Criada em" value={formatAdminDateTime(ticket.createdAt)} />
            <AdminInfoCard label="Paga em" value={formatAdminDateTime(ticket.paidAt)} />
            <AdminInfoCard label="Ultimo palpite" value={formatAdminDateTime(ticket.lastPredictionAt)} />
          </div>
        </section>

        <section className="rounded-[18px] border border-white/8 bg-[#101010] p-5">
          <h2 className="text-[15px] font-black text-white">Usuário e pagamento</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AdminInfoCard label="Nome" value={ticket.userName ?? "Sem nome"} />
            <AdminInfoCard label="E-mail" value={ticket.userEmail} />
            <AdminInfoCard label="CPF" value={maskAdminCpf(ticket.userCpf)} />
            <AdminInfoCard label="Telefone" value={ticket.userPhone ?? "Não informado"} />
            <AdminInfoCard label="Transação" value={<span className="font-mono text-[11px]">{ticket.transactionId ?? "Não informado"}</span>} />
            <AdminInfoCard label="ID provedor" value={<span className="font-mono text-[11px]">{ticket.providerTransactionId ?? "Não informado"}</span>} />
            <AdminInfoCard label="Status pagamento" value={<span className="uppercase text-primary">{formatCotaStatus(ticket.transactionStatus)}</span>} />
            <AdminInfoCard label="Valor pago" value={formatAdminBRLNullable(ticket.transactionAmountCents)} />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-[15px] font-black text-white">Palpites desta cota</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">Todos os jogos preenchidos pelo usuário nesta cota.</p>
        </div>
        <AdminCotaPredictionsTable predictions={ticket.predictions} />
      </section>
    </>
  );
}
