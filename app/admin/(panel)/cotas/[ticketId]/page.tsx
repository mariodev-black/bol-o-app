import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { formatAdminTicketType } from "@/lib/admin/format";
import { getAdminTicketDetail } from "@/lib/admin/sections";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
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

function formatCotaStatus(status: string | null) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "paid" || normalized === "approved") return "Paga";
  if (["pending_payment", "pending", "creating", "waiting_payment"].includes(normalized)) return "Pendente";
  if (["failed", "canceled", "cancelled", "refused", "expired"].includes(normalized)) return "Falhou";
  return status || "Nao informado";
}

function maskCpf(value: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return value ?? "Nao informado";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function cotaUsageStatus(ticket: {
  predictionsCount: number;
  pendingPredictionsCount: number;
}) {
  if (ticket.predictionsCount <= 0) return "Disponível";
  if (ticket.pendingPredictionsCount > 0) return "Em uso";
  return "Finalizada";
}

function predictionResultLabel(prediction: {
  resultCasa: number | null;
  resultVisitante: number | null;
}) {
  if (prediction.resultCasa == null || prediction.resultVisitante == null) return "Pendente";
  return `${prediction.resultCasa} x ${prediction.resultVisitante}`;
}

function predictionPointsLabel(prediction: {
  resultCasa: number | null;
  resultVisitante: number | null;
  points: number;
}) {
  if (prediction.resultCasa == null || prediction.resultVisitante == null) return "-";
  return `${prediction.points} pts`;
}

function TeamLogo({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[12px] font-black text-white/80">
        {alt.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white">
      <Image src={src} alt={alt} width={28} height={28} className="h-7 w-7 object-contain" unoptimized />
    </span>
  );
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/80">{label}</p>
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
        <InfoCard label="Pontuação" value={<span className="text-primary">{ticket.scorePoints.toLocaleString("pt-BR")} pts</span>} />
        <InfoCard label="Ranking modalidade" value={ticket.rankingPosition ? <span className="text-primary">#{ticket.rankingPosition}</span> : "Sem posição"} />
        <InfoCard label="Palpites enviados" value={`${ticket.predictionsCount}/${ticket.totalMatchesCount}`} />
        <InfoCard label="Palpites pendentes" value={ticket.pendingPredictionsCount.toLocaleString("pt-BR")} />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <InfoCard label="Status da cota" value={<span className="uppercase text-primary">{cotaUsageStatus(ticket)}</span>} />
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
            <InfoCard label="Preço unitário" value={formatBRL(ticket.unitPriceCents)} />
            <InfoCard label="Criada em" value={formatDate(ticket.createdAt)} />
            <InfoCard label="Paga em" value={formatDate(ticket.paidAt)} />
            <InfoCard label="Ultimo palpite" value={formatDate(ticket.lastPredictionAt)} />
          </div>
        </section>

        <section className="rounded-[18px] border border-white/8 bg-[#101010] p-5">
          <h2 className="text-[15px] font-black text-white">Usuário e pagamento</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoCard label="Nome" value={ticket.userName ?? "Sem nome"} />
            <InfoCard label="E-mail" value={ticket.userEmail} />
            <InfoCard label="CPF" value={maskCpf(ticket.userCpf)} />
            <InfoCard label="Telefone" value={ticket.userPhone ?? "Nao informado"} />
            <InfoCard label="Transação" value={<span className="font-mono text-[11px]">{ticket.transactionId ?? "Nao informado"}</span>} />
            <InfoCard label="ID provedor" value={<span className="font-mono text-[11px]">{ticket.providerTransactionId ?? "Nao informado"}</span>} />
            <InfoCard label="Status pagamento" value={<span className="uppercase text-primary">{formatCotaStatus(ticket.transactionStatus)}</span>} />
            <InfoCard label="Valor pago" value={formatBRL(ticket.transactionAmountCents)} />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-[15px] font-black text-white">Palpites desta cota</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">Todos os jogos preenchidos pelo usuário nesta cota.</p>
        </div>
        {ticket.predictions.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full table-fixed text-left">
              <thead className="border-b border-white/8 bg-white/2.5">
                <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
                  <th className="w-[390px] px-4 py-4">Jogo</th>
                  <th className="w-[130px] px-4 py-4">Data</th>
                  <th className="w-[110px] px-4 py-4 text-center">Palpite</th>
                  <th className="w-[120px] px-4 py-4 text-center">Resultado</th>
                  <th className="w-[110px] px-4 py-4 text-center">Pontos</th>
                  <th className="w-[140px] px-4 py-4">Status</th>
                  <th className="w-[160px] px-4 py-4">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {ticket.predictions.map((prediction) => (
                  <tr key={prediction.id} className="text-[13px] text-white/72">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <TeamLogo src={prediction.homeLogo} alt={prediction.homeName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-white">{prediction.homeName}</p>
                          <p className="mt-1 font-mono text-[12px] text-white/30">Partida #{prediction.matchId}</p>
                        </div>
                        <span className="shrink-0 text-[11px] font-black text-white/28">x</span>
                        <div className="min-w-0 flex-1 text-right">
                          <p className="truncate font-black text-white">{prediction.awayName}</p>
                          <p className="mt-1 text-[12px] text-white/25">visitante</p>
                        </div>
                        <TeamLogo src={prediction.awayLogo} alt={prediction.awayName} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      <p className="font-bold text-white/62">{prediction.dateBR ?? "Sem data"}</p>
                      <p className="mt-1 text-[14px] text-white/32">{prediction.hourBR ?? "Sem hora"}</p>
                    </td>
                    <td className="px-4 py-4 text-center font-black text-primary">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[12px]">
                        {prediction.scoreCasa} x {prediction.scoreVisitante}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center font-black text-white">
                      {predictionResultLabel(prediction)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={[
                        "rounded-full border px-3 py-1 text-[11px] font-black uppercase",
                        prediction.points > 0
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-white/10 bg-white/5 text-white/80",
                      ].join(" ")}>
                        {predictionPointsLabel(prediction)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-white/55">{prediction.status ?? "Nao informado"}</p>
                      <p className="mt-1 text-[14px] text-white/28">
                        {prediction.resultCasa == null || prediction.resultVisitante == null ? "Aguardando resultado" : "Resultado apurado"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-white/80">{formatDate(prediction.submittedAt)}</td>
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
