import type { ReactNode } from "react";
import { BolaoRankingPanel } from "@/app/admin/(panel)/boloes/_components/BolaoRankingPanel";
import type { AdminBolaoRankingRow, AdminBolaoRankingScope } from "@/lib/admin/boloes-ranking-types";

export function BolaoDetailRankingSection({
  title,
  description,
  scope,
  initialRows,
  total,
  emptyText,
  headerExtra,
}: {
  title: string;
  description: string;
  scope: AdminBolaoRankingScope;
  initialRows: AdminBolaoRankingRow[];
  total: number;
  emptyText: string;
  headerExtra?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/8 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-[15px] font-black text-white">{title}</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">{description}</p>
        </div>
        {headerExtra}
      </div>
      <BolaoRankingPanel
        scope={scope}
        initialRows={initialRows}
        total={total}
        emptyText={emptyText}
      />
    </section>
  );
}
