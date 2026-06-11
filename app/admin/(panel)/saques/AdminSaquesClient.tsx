"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { AdminTableScroll } from "@/app/admin/_components/AdminTableScroll";
import { AdminWithdrawalConfirmDialog } from "@/app/admin/_components/AdminWithdrawalConfirmDialog";
import { formatAdminBRL, formatAdminDate } from "@/lib/admin/format";
import type { AdminWithdrawalRow } from "@/lib/admin/withdrawals";

type Tab = "pending" | "processing" | "paid" | "failed" | "rejected" | "all";
type ConfirmState = { row: AdminWithdrawalRow; kind: "approve" | "reject" } | null;

export function AdminSaquesClient() {
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<AdminWithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/withdrawals?status=${tab}`, { credentials: "include" });
      const data = (await r.json()) as { rows?: AdminWithdrawalRow[]; error?: string };
      if (!r.ok) throw new Error(data.error ?? "Falha ao carregar saques");
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  function openConfirm(row: AdminWithdrawalRow, kind: "approve" | "reject") {
    setDialogError(null);
    setConfirm({ row, kind });
  }

  function closeConfirm() {
    if (submitting) return;
    setConfirm(null);
    setDialogError(null);
  }

  async function handleConfirm() {
    if (!confirm) return;
    const { row, kind } = confirm;
    setSubmitting(true);
    setDialogError(null);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch(`/api/admin/withdrawals/${row.id}/${kind}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: kind === "reject" ? JSON.stringify({}) : undefined,
      });
      const data = (await r.json()) as {
        ok?: boolean;
        error?: string;
        cartwaveTransactionId?: number | null;
      };
      if (!r.ok || !data.ok) {
        throw new Error(data.error ?? "Operacao falhou");
      }
      setConfirm(null);
      if (kind === "approve") {
        setSuccess(
          data.cartwaveTransactionId
            ? `PIX enviado (Cartwave #${data.cartwaveTransactionId}). Aguardando confirmacao do webhook.`
            : "PIX em processamento na Cartwave. Status final via webhook.",
        );
      } else {
        setSuccess("Saque recusado e saldo estornado ao usuario.");
      }
      await load();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "Erro na operacao");
    } finally {
      setSubmitting(false);
    }
  }

  const actionBusy = submitting && confirm !== null;

  return (
    <>
      <AdminPageTitle
        title="Saques"
        subtitle="Aprove para enviar PIX. O webhook Cartwave confirma pagamento ou estorna em caso de falha."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["pending", "Pendentes"],
            ["processing", "Processando PIX"],
            ["paid", "Pagos"],
            ["failed", "Falhos"],
            ["rejected", "Recusados"],
            ["all", "Todos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            disabled={actionBusy}
            className={[
              "rounded-full px-4 py-2 text-[12px] font-black uppercase tracking-wide disabled:opacity-50",
              tab === id ? "bg-primary text-black" : "border border-white/10 bg-white/5 text-white/60",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {success ? (
        <p className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-[13px] font-medium text-emerald-200">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[13px] font-medium text-red-300">
          {error}
        </p>
      ) : null}

      <section className="rounded-[18px] border border-white/8 bg-[#101010]">
        <AdminTableScroll hint={rows.length > 0}>
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-12 text-[13px] text-white/40">
              <Loader2 className="size-4 animate-spin" />
              Carregando…
            </p>
          ) : null}
          {!loading && rows.length === 0 ? (
            <p className="py-12 text-center text-[13px] font-bold text-white/38">Nenhum saque nesta aba.</p>
          ) : null}
          {!loading && rows.length > 0 ? (
            <table className="min-w-[980px] w-full text-left">
              <thead className="border-b border-white/8 bg-white/2.5">
                <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
                  <th className="px-4 py-4">Usuário</th>
                  <th className="px-4 py-4">Origem</th>
                  <th className="px-4 py-4">Valor</th>
                  <th className="px-4 py-4">PIX</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Solicitado</th>
                  <th className="px-4 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {rows.map((row) => (
                  <tr key={row.id} className="text-[13px] text-white/72">
                    <td className="px-4 py-4">
                      <Link href={`/admin/users/${row.userId}`} className="block">
                        <p className="font-black text-white hover:text-primary">{row.userName ?? "Sem nome"}</p>
                        <p className="mt-1 text-white/80">{row.userEmail}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-[11px] font-black uppercase",
                          row.balanceSource === "wallet"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                            : "border-primary/25 bg-primary/10 text-primary",
                        ].join(" ")}
                      >
                        {row.balanceSource === "wallet" ? "Conta" : "Afiliado"}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-black text-primary">{formatAdminBRL(row.amountCents)}</td>
                    <td className="px-4 py-4 text-white/80">
                      <p className="font-bold text-white/70 uppercase text-[11px]">{row.pixKeyType}</p>
                      <p className="mt-1 font-mono text-[12px] break-all">{row.pixKey}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black uppercase text-[11px] text-white/70">{row.status}</p>
                      {row.cartwaveTransactionId ? (
                        <p className="mt-1 text-[11px] text-white/45">Cartwave #{row.cartwaveTransactionId}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-white/80">{formatAdminDate(row.createdAt)}</td>
                    <td className="px-4 py-4 text-right">
                      {row.status === "pending" ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => openConfirm(row, "approve")}
                            className="rounded-full bg-primary px-4 py-2 text-[11px] font-black uppercase tracking-wide text-black disabled:opacity-40"
                          >
                            Aprovar PIX
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => openConfirm(row, "reject")}
                            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white/72 hover:bg-white/10 disabled:opacity-40"
                          >
                            Recusar
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-white/35">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </AdminTableScroll>
      </section>

      <AdminWithdrawalConfirmDialog
        open={confirm !== null}
        kind={confirm?.kind ?? "approve"}
        row={confirm?.row ?? null}
        submitting={submitting}
        error={dialogError}
        onClose={closeConfirm}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
