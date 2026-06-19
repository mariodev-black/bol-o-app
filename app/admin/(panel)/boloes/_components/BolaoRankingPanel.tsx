"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { BolaoRankingPodium } from "@/app/admin/(panel)/boloes/_components/BolaoRankingPodium";
import { BolaoRankingTableBody } from "@/app/admin/(panel)/boloes/_components/BolaoRankingTable";
import { AdminTableScroll } from "@/app/admin/_components/AdminTableScroll";
import {
  ADMIN_BOLAO_RANKING_PAGE_SIZE,
  type AdminBolaoRankingRow,
  type AdminBolaoRankingScope,
} from "@/lib/admin/boloes-ranking-types";

function scopeQuery(scope: AdminBolaoRankingScope): string {
  const q = new URLSearchParams();
  q.set("type", scope.type);
  if (scope.type === "daily") q.set("date", scope.date);
  if (scope.type === "extra") q.set("key", scope.key);
  if (scope.type === "definition") q.set("id", scope.id);
  return q.toString();
}

export function BolaoRankingPanel({
  scope,
  initialRows,
  total,
  emptyText,
}: {
  scope: AdminBolaoRankingScope;
  initialRows: AdminBolaoRankingRow[];
  total: number;
  emptyText: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const hasMore = rows.length < total;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || rows.length >= total) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const q = scopeQuery(scope);
      const resp = await fetch(
        `/api/admin/boloes/ranking?${q}&offset=${rows.length}&limit=${ADMIN_BOLAO_RANKING_PAGE_SIZE}`,
        { credentials: "include", cache: "no-store" },
      );
      const data = (await resp.json().catch(() => ({}))) as {
        rows?: AdminBolaoRankingRow[];
        error?: string;
      };
      if (!resp.ok) {
        setError(typeof data.error === "string" ? data.error : "Erro ao carregar mais linhas.");
        return;
      }
      const next = Array.isArray(data.rows) ? data.rows : [];
      if (next.length > 0) {
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.ticketId));
          const merged = [...prev];
          for (const row of next) {
            if (!seen.has(row.ticketId)) merged.push(row);
          }
          return merged;
        });
      }
    } catch {
      setError("Erro de rede ao carregar ranking.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [rows.length, scope, total]);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { root, rootMargin: "120px", threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (total === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-[15px] font-black text-white">{emptyText}</p>
        <p className="mt-2 text-[13px] text-white/38">
          Quando houver cotas pagas e palpites, o ranking aparece aqui.
        </p>
      </div>
    );
  }

  const showPodium = total >= 3;
  const tableRows = showPodium ? rows.filter((r) => r.position > 3) : rows;

  return (
    <div>
      {showPodium && rows.length >= 3 ? (
        <div className="border-b border-white/8 px-4 py-5 sm:px-5">
          <BolaoRankingPodium rows={rows.slice(0, 3)} />
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="max-h-[min(72vh,760px)] overflow-y-auto overscroll-y-contain [scrollbar-width:thin]"
      >
        <AdminTableScroll hint={false}>
          <table className="min-w-[980px] w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-white/8 bg-[#141414] shadow-[0_1px_0_rgba(255,255,255,0.06)]">
              <tr className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
                <th className="px-4 py-3.5">Posição</th>
                <th className="px-4 py-3.5">Usuário</th>
                <th className="px-4 py-3.5">Cota</th>
                <th className="px-4 py-3.5">Pontos</th>
                <th className="px-4 py-3.5">Desempenho</th>
                <th className="px-4 py-3.5">Palpites</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Paga em</th>
              </tr>
            </thead>
            <BolaoRankingTableBody rows={tableRows} />
          </table>
        </AdminTableScroll>

        <div ref={sentinelRef} className="h-px" aria-hidden />

        <div className="border-t border-white/6 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-white/42">
            <span>
              Mostrando{" "}
              <span className="font-black tabular-nums text-white/72">{rows.length}</span> de{" "}
              <span className="font-black tabular-nums text-white/72">{total}</span>
            </span>
            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-primary">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Carregando…
              </span>
            ) : hasMore ? (
              <span>Role para carregar mais</span>
            ) : (
              <span>Fim do ranking</span>
            )}
          </div>
          {error ? <p className="mt-2 text-[12px] font-medium text-red-400">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
