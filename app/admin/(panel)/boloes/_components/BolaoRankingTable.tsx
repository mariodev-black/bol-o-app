import { AdminTableScroll } from "@/app/admin/_components/AdminTableScroll";
import type { AdminBolaoRankingRow } from "@/lib/admin/boloes-ranking-types";
import Link from "next/link";

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "Não informado";
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

export function BolaoRankingTableBody({ rows }: { rows: AdminBolaoRankingRow[] }) {
  return (
    <tbody className="divide-y divide-white/6">
      {rows.map((row) => (
        <tr
          key={row.ticketId}
          className="group text-[13px] text-white/72 transition-colors hover:bg-white/2.5"
        >
          <td className="px-4 py-3.5">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">
              #{row.position}
            </span>
          </td>
          <td className="px-4 py-3.5">
            <Link href={`/admin/users/${row.userId}`} className="block">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-black text-white group-hover:text-primary">
                  {row.userName ?? "Sem nome"}
                </p>
                {row.isPromoBonus ? (
                  <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200">
                    Grátis
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[12px] text-white/55">{row.userEmail}</p>
            </Link>
          </td>
          <td className="px-4 py-3.5">
            <Link href={`/admin/cotas/${row.ticketId}`} className="block">
              <p className="font-mono text-[12px] font-black text-white group-hover:text-primary">
                #{shortId(row.ticketId)}
              </p>
            </Link>
          </td>
          <td className="px-4 py-3.5">
            <p className="text-[18px] font-black leading-none text-primary">
              {row.scorePoints.toLocaleString("pt-BR")}
            </p>
          </td>
          <td className="px-4 py-3.5">
            <p className="font-black text-white">{row.exactCount} exatos</p>
            <p className="mt-0.5 text-[12px] text-white/55">
              {row.outcomeCount} resultados · {row.goalsCount} gols
            </p>
          </td>
          <td className="px-4 py-3.5 font-black tabular-nums text-white">
            {row.predictionsCount}/{row.totalMatchesCount}
          </td>
          <td className="px-4 py-3.5">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase text-white/58">
              {usageLabel(row)}
            </span>
          </td>
          <td className="px-4 py-3.5 text-[12px] text-white/55">
            {formatDate(row.paidAt ?? row.createdAt)}
          </td>
        </tr>
      ))}
    </tbody>
  );
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
        <p className="mt-2 text-[13px] text-white/38">
          Quando houver cotas (pagas ou grátis) e palpites, o ranking aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <AdminTableScroll>
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
        <BolaoRankingTableBody rows={rows} />
      </table>
    </AdminTableScroll>
  );
}
