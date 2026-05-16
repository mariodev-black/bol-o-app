import type { AdminBolaoRankingRow } from "@/lib/admin/sections";
import Link from "next/link";

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function usageLabel(row: AdminBolaoRankingRow) {
  if (row.predictionsCount <= 0) return "Disponível";
  if (row.pendingPredictionsCount > 0) return "Em uso";
  return "Finalizada";
}

export function BolaoRankingTable({
  rows,
  emptyText,
}: {
  rows: AdminBolaoRankingRow[];
  emptyText: string;
}) {
  if (!rows.length) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-[15px] font-black text-white">{emptyText}</p>
        <p className="mt-2 text-[13px] text-white/38">Quando houver cotas pagas e palpites, o ranking aparece aqui.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-left">
        <thead className="border-b border-white/8 bg-white/2.5">
          <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
            <th className="px-4 py-4">Posição</th>
            <th className="px-4 py-4">Usuário</th>
            <th className="px-4 py-4">Cota</th>
            <th className="px-4 py-4">Pontos</th>
            <th className="px-4 py-4">Desempenho</th>
            <th className="px-4 py-4">Palpites</th>
            <th className="px-4 py-4">Status</th>
            <th className="px-4 py-4">Paga em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/6">
          {rows.map((row) => (
            <tr key={row.ticketId} className="group text-[13px] text-white/72 transition-colors hover:bg-white/2.5">
              <td className="px-4 py-4">
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">
                  #{row.position}
                </span>
              </td>
              <td className="px-4 py-4">
                <Link href={`/admin/users/${row.userId}`} className="block">
                  <p className="font-black text-white group-hover:text-primary">{row.userName ?? "Sem nome"}</p>
                  <p className="mt-1 text-white/80">{row.userEmail}</p>
                </Link>
              </td>
              <td className="px-4 py-4">
                <Link href={`/admin/cotas/${row.ticketId}`} className="block">
                  <p className="font-mono text-[12px] font-black text-white group-hover:text-primary">#{shortId(row.ticketId)}</p>
                  <p className="mt-1 text-[14px] text-white/30">{row.ticketId}</p>
                </Link>
              </td>
              <td className="px-4 py-4">
                <p className="text-[20px] font-black leading-none text-primary">{row.scorePoints.toLocaleString("pt-BR")}</p>
                <p className="mt-1 text-[14px] text-white/80">pontos</p>
              </td>
              <td className="px-4 py-4">
                <p className="font-black text-white">{row.exactCount} exatos</p>
                <p className="mt-1 text-[14px] text-white/80">
                  {row.outcomeCount} resultados · {row.goalsCount} gols
                </p>
              </td>
              <td className="px-4 py-4 font-black text-white">
                {row.predictionsCount}/{row.totalMatchesCount}
              </td>
              <td className="px-4 py-4">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase text-white/58">
                  {usageLabel(row)}
                </span>
              </td>
              <td className="px-4 py-4 text-white/80">{formatDate(row.paidAt ?? row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
