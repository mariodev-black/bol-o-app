import type { AdminBolaoRankingRow } from "@/lib/admin/boloes-ranking-types";

const podiumStyles = [
  {
    ring: "border-amber-400/35 bg-amber-400/10",
    badge: "bg-amber-400/20 text-amber-200",
    label: "1º",
  },
  {
    ring: "border-white/20 bg-white/6",
    badge: "bg-white/10 text-white/75",
    label: "2º",
  },
  {
    ring: "border-orange-400/25 bg-orange-400/8",
    badge: "bg-orange-400/15 text-orange-200",
    label: "3º",
  },
] as const;

export function BolaoRankingPodium({ rows }: { rows: AdminBolaoRankingRow[] }) {
  const order = [rows[1], rows[0], rows[2]].filter(Boolean) as AdminBolaoRankingRow[];

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-white/38">Top 3</p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        {order.map((row) => {
          const style = podiumStyles[row.position - 1] ?? podiumStyles[2];
          const elevated = row.position === 1;
          return (
            <div
              key={row.ticketId}
              className={`rounded-[14px] border px-2 py-3 text-center sm:px-3 sm:py-4 ${style.ring} ${
                elevated ? "sm:-translate-y-1" : ""
              }`}
            >
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${style.badge}`}
              >
                {style.label}
              </span>
              <p className="mt-2 truncate text-[12px] font-black text-white sm:text-[13px]">
                {row.userName ?? "Sem nome"}
              </p>
              <p className="mt-1 text-[18px] font-black tabular-nums leading-none text-primary sm:text-[22px]">
                {row.scorePoints.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-[10px] font-medium text-white/40">
                {row.outcomeCount} acertos
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
