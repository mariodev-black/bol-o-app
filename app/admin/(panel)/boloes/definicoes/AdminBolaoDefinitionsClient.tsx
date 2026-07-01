"use client";

import { AdminTableScroll } from "@/app/admin/_components/AdminTableScroll";
import type { BolaoDefinitionWithStats } from "@/lib/boloes/definitions/types";
import { ticketTypeLabel, SCOPE_MODE_LABELS } from "@/lib/boloes/definitions/presets";
import { Copy, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
}

export function AdminBolaoDefinitionsClient() {
  const [items, setItems] = useState<BolaoDefinitionWithStats[]>([]);
  const [overview, setOverview] = useState<{
    totalDefinitions: number;
    activeForSale: number;
    totalTicketsPaid: number;
    totalRevenueCents: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [defsRes, overviewRes] = await Promise.all([
        fetch("/api/admin/boloes/definitions?stats=1", { credentials: "include" }),
        fetch("/api/admin/boloes/definitions/overview", { credentials: "include" }),
      ]);
      const defsData = (await defsRes.json()) as {
        items?: BolaoDefinitionWithStats[];
        error?: string;
      };
      const overviewData = (await overviewRes.json()) as {
        overview?: NonNullable<typeof overview>;
        error?: string;
      };
      if (!defsRes.ok) throw new Error(defsData.error ?? "Falha ao listar");
      setItems(defsData.items ?? []);
      if (overviewRes.ok && overviewData.overview) {
        setOverview(overviewData.overview);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleDuplicate(id: string) {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/boloes/definitions/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Falha ao duplicar");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao duplicar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Desativar este bolão? Ele sairá da venda.")) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/boloes/definitions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        throw new Error(d.error ?? "Falha ao desativar");
      }
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao desativar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/boloes"
          className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/45 hover:text-primary"
        >
          ← Voltar aos bolões
        </Link>
        <Link
          href="/admin/boloes/definicoes/novo"
          className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-[12px] font-black uppercase tracking-wide text-[#0E141B]"
        >
          <Plus className="size-4" />
          Criar bolão
        </Link>
      </div>

      {overview ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Bolões cadastrados", value: String(overview.totalDefinitions) },
            { label: "Ativos na loja", value: String(overview.activeForSale) },
            { label: "Cotas vendidas", value: String(overview.totalTicketsPaid) },
            { label: "Receita confirmada", value: formatBRL(overview.totalRevenueCents) },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-[14px] border border-white/8 bg-[#101010] px-4 py-3"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                {card.label}
              </p>
              <p className="mt-1 text-[22px] font-black tabular-nums text-white">{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[12px] border border-red-400/30 bg-red-500/10 px-4 py-3 text-[13px] font-medium text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/50">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <AdminTableScroll>
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/8 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                <th className="px-3 py-3">Bolão</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Escopo</th>
                <th className="px-3 py-3">Preço</th>
                <th className="px-3 py-3">Cotas</th>
                <th className="px-3 py-3">Receita</th>
                <th className="px-3 py-3">Venda</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center">
                    <p className="text-white/45">Nenhum bolão configurado.</p>
                    <Link
                      href="/admin/boloes/definicoes/novo"
                      className="mt-3 inline-flex text-[13px] font-bold text-primary hover:underline"
                    >
                      Criar o primeiro bolão →
                    </Link>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-white/6 hover:bg-white/[0.02]">
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/boloes/definicoes/${item.id}`}
                        className="font-bold text-white hover:text-primary"
                      >
                        {item.displayName}
                      </Link>
                      <p className="text-[11px] text-white/40">{item.slug}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-white/8 px-2 py-0.5 text-[10px] font-black uppercase text-white/55">
                        {ticketTypeLabel(item.ticketType)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-white/60">
                      {SCOPE_MODE_LABELS[item.scopeMode]}
                    </td>
                    <td className="px-3 py-3 font-bold tabular-nums text-white">
                      {formatBRL(item.unitPriceCents)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white/75">{item.ticketsPaid}</td>
                    <td className="px-3 py-3 font-bold tabular-nums text-primary">
                      {formatBRL(item.revenueCents)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                          item.saleEnabled && item.enabled
                            ? "bg-primary/15 text-primary"
                            : "bg-white/8 text-white/40"
                        }`}
                      >
                        {item.saleEnabled && item.enabled ? "Ativo" : "Off"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/boloes/definicoes/${item.id}`}
                          className="rounded-lg border border-white/10 p-2 text-white/70 hover:bg-white/5"
                          aria-label="Detalhes"
                        >
                          <Eye className="size-4" />
                        </Link>
                        <Link
                          href={`/admin/boloes/definicoes/${item.id}/edit`}
                          className="rounded-lg border border-white/10 p-2 text-white/70 hover:bg-white/5"
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Link>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleDuplicate(item.id)}
                          className="rounded-lg border border-white/10 p-2 text-white/70 hover:bg-white/5 disabled:opacity-40"
                          aria-label="Duplicar"
                        >
                          <Copy className="size-4" />
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleDelete(item.id)}
                          className="rounded-lg border border-red-400/20 p-2 text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                          aria-label="Desativar"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminTableScroll>
      )}
    </div>
  );
}
