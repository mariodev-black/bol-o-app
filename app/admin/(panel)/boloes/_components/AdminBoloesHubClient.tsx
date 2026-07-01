"use client";

import { AdminBolaoDefinitionCard } from "@/app/admin/(panel)/boloes/_components/AdminBolaoDefinitionCard";
import {
  ADMIN_BOLAO_HUB_FILTERS,
  bolaoMatchesSearch,
  countByAdminBolaoFilter,
  matchesAdminBolaoFilter,
  type AdminBolaoHubFilter,
} from "@/lib/admin/bolao-hub-filter";
import type { AdminBolaoHubItem } from "@/lib/boloes/definitions/types";
import {
  ArrowRight,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Ticket,
  Trophy,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

const LEGACY_LINKS = [
  { href: "/admin/boloes/principal", label: "Principal" },
  { href: "/admin/boloes/artilheiros", label: "Artilheiros" },
  { href: "/admin/boloes/diario", label: "Diário" },
  { href: "/admin/boloes/amistosos", label: "Amistosos" },
] as const;

type Props = {
  initialItems: AdminBolaoHubItem[];
};

export function AdminBoloesHubClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<AdminBolaoHubFilter>("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overview = useMemo(
    () => ({
      total: items.length,
      activeForSale: items.filter((i) => i.enabled && i.saleEnabled).length,
      ticketsPaid: items.reduce((s, i) => s + i.ticketsPaid, 0),
      revenueCents: items.reduce((s, i) => s + i.revenueCents, 0),
      participants: items.reduce((s, i) => s + i.participants, 0),
    }),
    [items],
  );

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => matchesAdminBolaoFilter(item, filter))
      .filter((item) => bolaoMatchesSearch(item, search))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [items, filter, search]);

  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        ADMIN_BOLAO_HUB_FILTERS.map((f) => [
          f.id,
          countByAdminBolaoFilter(items, f.id),
        ]),
      ) as Record<AdminBolaoHubFilter, number>,
    [items],
  );

  const reload = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/boloes/hub", {
        credentials: "include",
      });
      const d = (await r.json()) as {
        items?: AdminBolaoHubItem[];
        error?: string;
      };
      if (!r.ok) throw new Error(d.error ?? "Falha ao atualizar lista");
      setItems(d.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setRefreshing(false);
    }
  }, []);

  async function handleDuplicate(id: string) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/boloes/definitions/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Falha ao duplicar");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao duplicar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Desativar este bolão? Ele sairá da venda.")) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/boloes/definitions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        throw new Error(d.error ?? "Falha ao desativar");
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao desativar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/boloes/definicoes/novo"
        className="group inline-flex shrink-0 items-center justify-center gap-2.5 rounded-[14px] bg-primary px-5 py-3.5 text-[13px] font-black uppercase tracking-wide text-[#0a0a0a] shadow-[0_8px_32px_-8px_rgba(212,175,55,0.55)] transition hover:brightness-110"
      >
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#0a0a0a]/15">
          <Plus className="size-4" strokeWidth={2.8} />
        </span>
        Criar bolão
        <ArrowRight
          className="size-4 transition group-hover:translate-x-0.5"
          strokeWidth={2.5}
        />
      </Link>

      {/* Métricas */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Trophy, label: "Bolões", value: String(overview.total) },
          {
            icon: Ticket,
            label: "Ativos na loja",
            value: String(overview.activeForSale),
          },
          {
            icon: Users,
            label: "Cotas vendidas",
            value: overview.ticketsPaid.toLocaleString("pt-BR"),
          },
          {
            icon: TrendingUp,
            label: "Receita",
            value: formatBRL(overview.revenueCents),
            accent: true,
          },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div
            key={label}
            className={`rounded-[16px] border p-4 ${
              accent
                ? "border-primary/25 bg-primary/6"
                : "border-white/8 bg-[#101010]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon
                className={`size-4 ${accent ? "text-primary" : "text-white/45"}`}
                strokeWidth={2.2}
              />
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/38">
                {label}
              </p>
            </div>
            <p
              className={`mt-2 truncate text-[22px] font-black tabular-nums ${
                accent ? "text-primary" : "text-white"
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </section>

      {/* Filtros + busca */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ADMIN_BOLAO_HUB_FILTERS.map((tab) => {
              const active = filter === tab.id;
              const count = filterCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-bold transition ${
                    active
                      ? "border-white/20 bg-white text-[#0a0a0a]"
                      : "border-white/8 bg-[#0c0c0c] text-white/50 hover:border-white/14 hover:text-white/75"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                      active
                        ? "bg-[#0a0a0a]/10 text-[#0a0a0a]"
                        : "bg-white/8 text-white/45"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[220px] lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar bolão…"
              className="w-full rounded-[12px] border border-white/8 bg-[#0c0c0c] py-2.5 pl-9 pr-3 text-[13px] text-white outline-none focus:border-white/18"
            />
          </div>
        </div>

        {refreshing ? (
          <p className="flex items-center gap-2 text-[12px] text-white/40">
            <Loader2 className="size-3.5 animate-spin" />
            Atualizando lista…
          </p>
        ) : null}

        {error ? (
          <div className="rounded-[12px] border border-red-400/25 bg-red-950/30 px-4 py-3 text-[13px] text-red-200">
            {error}
          </div>
        ) : null}
      </section>

      {/* Grid */}
      {filteredItems.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => (
            <AdminBolaoDefinitionCard
              key={item.id}
              item={item}
              saving={saving}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-[20px] border border-dashed border-white/12 bg-[#0c0c0c]/60 px-6 py-16 text-center">
          <Trophy
            className="mx-auto size-10 text-white/15"
            strokeWidth={1.75}
          />
          <p className="mt-4 text-[16px] font-black text-white">
            {items.length === 0
              ? "Nenhum bolão criado ainda"
              : "Nenhum bolão neste filtro"}
          </p>
          <p className="mt-2 text-[13px] text-white/40">
            {items.length === 0
              ? "Comece pelo assistente passo a passo."
              : "Tente outro filtro ou limpe a busca."}
          </p>
          {items.length === 0 ? (
            <Link
              href="/admin/boloes/definicoes/novo"
              className="mt-6 inline-flex items-center gap-2 rounded-[12px] bg-primary px-5 py-2.5 text-[12px] font-black uppercase tracking-wide text-[#0a0a0a]"
            >
              <Plus className="size-4" />
              Criar primeiro bolão
            </Link>
          ) : null}
        </section>
      )}

      {/* Legado */}
      <section className="rounded-[16px] border border-white/6 bg-[#0a0a0a] px-4 py-4 sm:px-5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/30">
          Rankings legados
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {LEGACY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-white/8 bg-white/3 px-3.5 py-1.5 text-[12px] font-bold text-white/50 transition hover:border-white/16 hover:text-white/80"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
