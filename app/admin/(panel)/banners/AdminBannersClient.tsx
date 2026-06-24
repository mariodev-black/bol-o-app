"use client";

import { Loader2, Plus, Trash2, Upload, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeBanner, HomeBolaoCard } from "@/lib/home-content/types";

const FIELD =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-[#B1EB0B]/40 focus:outline-none";
const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-white/40";
const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-lg bg-[#B1EB0B] px-3 py-2 text-[12px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98] disabled:opacity-50";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-[12px] font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-50";

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-[#B1EB0B]" : "bg-white/15"
      } disabled:opacity-50`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

// ── Banners ───────────────────────────────────────────────────

function BannerRow({
  banner,
  onChanged,
  onError,
}: {
  banner: HomeBanner;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const [alt, setAlt] = useState(banner.alt);
  const [href, setHref] = useState(banner.href);
  const [sortOrder, setSortOrder] = useState(String(banner.sortOrder));
  const [enabled, setEnabled] = useState(banner.enabled);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/home-banners/${banner.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alt,
          href,
          sortOrder: Number(sortOrder) || 0,
          enabled,
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Falha ao salvar");
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/admin/home-banners/${banner.id}/image`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Falha no upload");
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Excluir este banner?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/home-banners/${banner.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        throw new Error(d.error ?? "Falha ao excluir");
      }
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/8 bg-[#0d0d0d] p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black sm:w-40">
          {banner.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner.imageUrl}
              alt={banner.alt}
              className="h-24 w-full object-contain"
            />
          ) : (
            <div className="flex h-24 w-full items-center justify-center text-[11px] text-white/30">
              Sem imagem
            </div>
          )}
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL}>Texto (alt)</label>
            <input className={FIELD} value={alt} onChange={(e) => setAlt(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Link (href)</label>
            <input
              className={FIELD}
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/comprar-cotas"
            />
          </div>
          <div>
            <label className={LABEL}>Ordem</label>
            <input
              className={FIELD}
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Toggle checked={enabled} onChange={setEnabled} disabled={busy} />
          <span className="text-[12px] font-semibold text-white/60">
            {enabled ? "Ativo" : "Oculto"}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className={BTN_GHOST}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" /> Imagem
          </button>
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={remove}>
            <Trash2 className="size-3.5" /> Excluir
          </button>
          <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={save}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cards de bolão ────────────────────────────────────────────

function CardRow({
  card,
  onChanged,
  onError,
}: {
  card: HomeBolaoCard;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({
    name: card.name,
    badge: card.badge ?? "",
    badgeVariant: card.badgeVariant,
    dateText: card.dateText ?? "",
    timeText: card.timeText ?? "",
    prizeLabel: card.prizeLabel ?? "",
    prizeUnit: card.prizeUnit ?? "",
    href: card.href,
    isPrimary: card.isPrimary,
    sortOrder: String(card.sortOrder),
    enabled: card.enabled,
  });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/home-bolao-cards/${card.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          badge: form.badge || null,
          dateText: form.dateText || null,
          timeText: form.timeText || null,
          prizeLabel: form.prizeLabel || null,
          prizeUnit: form.prizeUnit || null,
          sortOrder: Number(form.sortOrder) || 0,
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Falha ao salvar");
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/admin/home-bolao-cards/${card.id}/image`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Falha no upload");
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Excluir este card?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/home-bolao-cards/${card.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        throw new Error(d.error ?? "Falha ao excluir");
      }
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/8 bg-[#0d0d0d] p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black sm:w-28">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt={card.name} className="h-20 w-full object-contain" />
          ) : (
            <div className="flex h-20 w-full items-center justify-center text-[11px] text-white/30">
              Sem logo
            </div>
          )}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={LABEL}>Nome</label>
            <input className={FIELD} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Badge</label>
            <input className={FIELD} value={form.badge} onChange={(e) => set("badge", e.target.value)} placeholder="EM BREVE" />
          </div>
          <div>
            <label className={LABEL}>Estilo do badge</label>
            <select
              className={FIELD}
              value={form.badgeVariant}
              onChange={(e) => set("badgeVariant", e.target.value as "primary" | "muted")}
            >
              <option value="muted">Neutro</option>
              <option value="primary">Destaque</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Data</label>
            <input className={FIELD} value={form.dateText} onChange={(e) => set("dateText", e.target.value)} placeholder="TER, 11/06" />
          </div>
          <div>
            <label className={LABEL}>Hora</label>
            <input className={FIELD} value={form.timeText} onChange={(e) => set("timeText", e.target.value)} placeholder="16:00" />
          </div>
          <div>
            <label className={LABEL}>Prêmio</label>
            <input className={FIELD} value={form.prizeLabel} onChange={(e) => set("prizeLabel", e.target.value)} placeholder="R$ 500.000" />
          </div>
          <div>
            <label className={LABEL}>Unidade do prêmio</label>
            <input className={FIELD} value={form.prizeUnit} onChange={(e) => set("prizeUnit", e.target.value)} placeholder="NO PIX" />
          </div>
          <div>
            <label className={LABEL}>Link (href)</label>
            <input className={FIELD} value={form.href} onChange={(e) => set("href", e.target.value)} placeholder="/tickets?bolao=extra" />
          </div>
          <div>
            <label className={LABEL}>Ordem</label>
            <input className={FIELD} type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} disabled={busy} />
          <span className="text-[12px] font-semibold text-white/60">
            {form.enabled ? "Ativo" : "Oculto"}
          </span>
        </div>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-white/60">
          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={(e) => set("isPrimary", e.target.checked)}
          />
          Card principal
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
              e.target.value = "";
            }}
          />
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Logo
          </button>
          <button type="button" className={BTN_GHOST} disabled={busy} onClick={remove}>
            <Trash2 className="size-3.5" /> Excluir
          </button>
          <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={save}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tela ──────────────────────────────────────────────────────

export function AdminBannersClient() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [cards, setCards] = useState<HomeBolaoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [b, c] = await Promise.all([
        fetch("/api/admin/home-banners", { credentials: "include" }),
        fetch("/api/admin/home-bolao-cards", { credentials: "include" }),
      ]);
      const bd = (await b.json()) as { items?: HomeBanner[]; error?: string };
      const cd = (await c.json()) as { items?: HomeBolaoCard[]; error?: string };
      if (!b.ok) throw new Error(bd.error ?? "Falha ao listar banners");
      if (!c.ok) throw new Error(cd.error ?? "Falha ao listar cards");
      setBanners(bd.items ?? []);
      setCards(cd.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function createBanner() {
    setCreating(true);
    try {
      const r = await fetch("/api/admin/home-banners", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt: "Novo banner", href: "", sortOrder: banners.length }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        throw new Error(d.error ?? "Falha ao criar");
      }
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setCreating(false);
    }
  }

  async function createCard() {
    setCreating(true);
    try {
      const r = await fetch("/api/admin/home-bolao-cards", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Novo card", href: "", sortOrder: cards.length }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        throw new Error(d.error ?? "Falha ao criar");
      }
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-white/40">
        <Loader2 className="size-5 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-300">
          {error}
        </p>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-black text-white">Carrossel principal</h2>
          <button type="button" className={BTN_PRIMARY} disabled={creating} onClick={createBanner}>
            <Plus className="size-3.5" /> Novo banner
          </button>
        </div>
        {banners.length === 0 ? (
          <p className="rounded-lg border border-white/8 bg-white/5 px-3 py-6 text-center text-[13px] text-white/40">
            Nenhum banner cadastrado — a home mostra os banners padrão.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {banners.map((b) => (
              <BannerRow key={b.id} banner={b} onChanged={loadAll} onError={setError} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-black text-white">Cards · Próximos Bolões</h2>
          <button type="button" className={BTN_PRIMARY} disabled={creating} onClick={createCard}>
            <Plus className="size-3.5" /> Novo card
          </button>
        </div>
        {cards.length === 0 ? (
          <p className="rounded-lg border border-white/8 bg-white/5 px-3 py-6 text-center text-[13px] text-white/40">
            Nenhum card cadastrado — a home mostra os cards padrão.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {cards.map((c) => (
              <CardRow key={c.id} card={c} onChanged={loadAll} onError={setError} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
