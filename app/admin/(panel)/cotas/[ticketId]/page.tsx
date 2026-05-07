import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { formatAdminTicketType } from "@/lib/admin/format";
import { getAdminTicketDetail } from "@/lib/admin/sections";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

function formatBRL(cents: number | null) {
  if (cents == null) return "Nao informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function maskCpf(value: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return value ?? "Nao informado";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
      <div className="mt-3 text-[14px] font-bold text-white/82">{value}</div>
    </article>
  );
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

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <InfoCard label="Palpites enviados" value={`${ticket.predictionsCount}/${ticket.totalMatchesCount}`} />
        <InfoCard label="Palpites pendentes" value={ticket.pendingPredictionsCount.toLocaleString("pt-BR")} />
        <InfoCard label="Status da cota" value={<span className="uppercase text-primary">{ticket.status}</span>} />
        <InfoCard label="Valor da cota" value={formatBRL(ticket.totalAmountCents)} />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <section className="rounded-[18px] border border-white/8 bg-[#101010] p-5">
          <h2 className="text-[15px] font-black text-white">Dados da cota</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoCard label="ID" value={<span className="font-mono text-[11px]">{ticket.id}</span>} />
            <InfoCard label="Referencia" value={<span className="font-mono text-[11px]">{ticket.externalRef ?? "Nao informado"}</span>} />
            <InfoCard label="Tipo" value={<span className="uppercase">{formatAdminTicketType(ticket.ticketType)}</span>} />
            <InfoCard label="Quantidade" value={ticket.quantity.toLocaleString("pt-BR")} />
            <InfoCard label="Preco unitario" value={formatBRL(ticket.unitPriceCents)} />
            <InfoCard label="Criada em" value={formatDate(ticket.createdAt)} />
            <InfoCard label="Paga em" value={formatDate(ticket.paidAt)} />
            <InfoCard label="Ultimo palpite" value={formatDate(ticket.lastPredictionAt)} />
          </div>
        </section>

        <section className="rounded-[18px] border border-white/8 bg-[#101010] p-5">
          <h2 className="text-[15px] font-black text-white">Usuario e pagamento</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoCard label="Nome" value={ticket.userName ?? "Sem nome"} />
            <InfoCard label="E-mail" value={ticket.userEmail} />
            <InfoCard label="CPF" value={maskCpf(ticket.userCpf)} />
            <InfoCard label="Telefone" value={ticket.userPhone ?? "Nao informado"} />
            <InfoCard label="Transacao" value={<span className="font-mono text-[11px]">{ticket.transactionId ?? "Nao informado"}</span>} />
            <InfoCard label="ID provedor" value={<span className="font-mono text-[11px]">{ticket.providerTransactionId ?? "Nao informado"}</span>} />
            <InfoCard label="Status pagamento" value={<span className="uppercase text-primary">{ticket.transactionStatus ?? "Nao informado"}</span>} />
            <InfoCard label="Valor pago" value={formatBRL(ticket.transactionAmountCents)} />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-[15px] font-black text-white">Palpites desta cota</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">Todos os jogos preenchidos pelo usuario nesta cota.</p>
        </div>
        {ticket.predictions.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left">
              <thead className="border-b border-white/8 bg-white/2.5">
                <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                  <th className="px-4 py-4">Jogo</th>
                  <th className="px-4 py-4">Data</th>
                  <th className="px-4 py-4">Palpite</th>
                  <th className="px-4 py-4">Resultado</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {ticket.predictions.map((prediction) => (
                  <tr key={prediction.id} className="text-[13px] text-white/72">
                    <td className="px-4 py-4">
                      <p className="font-bold text-white">{prediction.homeName} x {prediction.awayName}</p>
                      <p className="mt-1 font-mono text-[10px] text-white/30">#{prediction.matchId}</p>
                    </td>
                    <td className="px-4 py-4 text-white/45">
                      {prediction.dateBR ?? "Sem data"} {prediction.hourBR ? `- ${prediction.hourBR}` : ""}
                    </td>
                    <td className="px-4 py-4 font-black text-primary">
                      {prediction.scoreCasa} x {prediction.scoreVisitante}
                    </td>
                    <td className="px-4 py-4 font-black text-white">
                      {prediction.resultCasa == null || prediction.resultVisitante == null
                        ? "Pendente"
                        : `${prediction.resultCasa} x ${prediction.resultVisitante}`}
                    </td>
                    <td className="px-4 py-4 text-white/45">{prediction.status ?? "Nao informado"}</td>
                    <td className="px-4 py-4 text-white/45">{formatDate(prediction.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="text-[15px] font-black text-white">Nenhum palpite enviado ainda</p>
            <p className="mt-2 text-[13px] text-white/38">Quando o usuario preencher a cota, os palpites aparecem aqui.</p>
          </div>
        )}
      </section>
    </>
  );
}
