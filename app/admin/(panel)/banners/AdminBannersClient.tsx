"use client";

import {
  AlertTriangle,
  GripVertical,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/app/components/ui/dialog";
import { useBolaoToast } from "@/app/components/BolaoToast";
import type { HomeBanner, HomeBolaoCard } from "@/lib/home-content/types";

const FIELD =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 transition focus:border-[#B1EB0B]/50 focus:bg-white/[0.07] focus:outline-none";
const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-white/40";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#B1EB0B] px-3.5 py-2 text-[12px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
const BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-[12px] font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-50";
const BTN_DANGER =
  "inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50";

type SaveState = "idle" | "saving" | "saved";

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
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function SaveButton({
  state,
  dirty,
  onClick,
  createLabel = false,
}: {
  state: SaveState;
  dirty: boolean;
  onClick: () => void;
  /** Rascunho: rótulo "Criar" e habilitado quando há conteúdo. */
  createLabel?: boolean;
}) {
  return (
    <button
      type="button"
      className={BTN_PRIMARY}
      disabled={state === "saving" || (!dirty && state !== "saved")}
      onClick={onClick}
    >
      {state === "saving" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" /> {createLabel ? "Criando…" : "Salvando…"}
        </>
      ) : state === "saved" && !dirty ? (
        <>✓ Salvo</>
      ) : (
        <>
          <Save className="size-3.5" /> {createLabel ? "Criar" : "Salvar"}
        </>
      )}
    </button>
  );
}

function ConfirmDelete({
  open,
  label,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  label: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-500/15">
              <AlertTriangle className="size-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-white">Excluir {label}?</h3>
              <p className="mt-1 text-[13px] text-white/55">
                Essa ação não pode ser desfeita.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN_GHOST} disabled={busy} onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className={BTN_DANGER} disabled={busy} onClick={onConfirm}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Excluir
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Banner ────────────────────────────────────────────────────

function BannerRow({
  banner,
  dragHandlers,
  onChanged,
  onCancelDraft,
}: {
  /** null = rascunho novo (ainda não existe no banco). */
  banner: HomeBanner | null;
  dragHandlers: ReactDragHandlers;
  onChanged: () => void;
  onCancelDraft?: () => void;
}) {
  const toast = useBolaoToast();
  const isDraft = banner === null;
  const [alt, setAlt] = useState(banner?.alt ?? "");
  const [href, setHref] = useState(banner?.href ?? "");
  const [enabled, setEnabled] = useState(banner?.enabled ?? true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = isDraft
    ? alt.trim() !== "" || href.trim() !== ""
    : alt !== banner.alt || href !== banner.href || enabled !== banner.enabled;

  async function save() {
    setSaveState("saving");
    try {
      // Rascunho → cria (POST). Existente → atualiza (PUT).
      const r = await fetch(
        isDraft ? "/api/admin/home-banners" : `/api/admin/home-banners/${banner.id}`,
        {
          method: isDraft ? "POST" : "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alt, href, enabled }),
        },
      );
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Falha ao salvar");
      setSaveState("saved");
      toast.success(isDraft ? "Banner criado" : "Banner salvo");
      onChanged();
    } catch (e) {
      setSaveState("idle");
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function uploadImage(file: File) {
    if (!banner) return;
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
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
      toast.success("Imagem atualizada");
      onChanged();
    } catch (e) {
      setPreviewUrl(null);
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    if (!banner) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/home-banners/${banner.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        throw new Error(d.error ?? "Falha ao excluir");
      }
      toast.success("Banner excluído");
      setConfirmOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  }

  const img = previewUrl ?? banner?.imageUrl ?? null;

  return (
    <div
      className={`group flex flex-col gap-3 rounded-xl border bg-[#0d0d0d] p-3 transition sm:flex-row ${
        isDraft
          ? "border-[#B1EB0B]/30 ring-1 ring-[#B1EB0B]/10"
          : dragHandlers.isDragging
            ? "border-[#B1EB0B]/40 opacity-60"
            : "border-white/8"
      } ${!enabled && !isDraft ? "opacity-70" : ""}`}
      draggable={!isDraft}
      {...(isDraft ? {} : dragHandlers.rowProps)}
    >
      {!isDraft ? (
        <button
          type="button"
          className="hidden shrink-0 cursor-grab items-center self-stretch px-1 text-white/25 hover:text-white/50 active:cursor-grabbing sm:flex"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="size-4" />
        </button>
      ) : null}

      <div className="relative flex w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black sm:w-44">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={alt} className="h-24 w-full object-contain" />
        ) : (
          <div className="flex h-24 w-full flex-col items-center justify-center gap-1 text-white/25">
            <ImageIcon className="size-5" />
            <span className="text-[11px] text-center">
              {isDraft ? "Salve para enviar a imagem" : "Sem imagem"}
            </span>
          </div>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="size-5 animate-spin text-[#B1EB0B]" />
          </div>
        ) : null}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        {isDraft ? (
          <span className="inline-flex w-fit items-center rounded-full bg-[#B1EB0B]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#B1EB0B] sm:col-span-2">
            Novo banner
          </span>
        ) : null}
        <div className="sm:col-span-2">
          <label className={LABEL}>Texto (acessibilidade)</label>
          <input className={FIELD} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Descreva o banner" />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Link ao clicar</label>
          <input className={FIELD} value={href} onChange={(e) => setHref(e.target.value)} placeholder="/comprar-cotas" />
        </div>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <div className="flex items-center gap-2">
            <Toggle checked={enabled} onChange={setEnabled} disabled={saveState === "saving"} />
            <span className="text-[12px] font-semibold text-white/60">
              {enabled ? "Visível na home" : "Oculto"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && !isDraft ? (
              <span className="text-[11px] font-semibold text-amber-300/80">Não salvo</span>
            ) : null}
            {isDraft ? (
              <button type="button" className={BTN_GHOST} onClick={onCancelDraft}>
                Cancelar
              </button>
            ) : (
              <>
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
                <button type="button" className={BTN_GHOST} disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" /> Imagem
                </button>
                <button type="button" className={BTN_DANGER} onClick={() => setConfirmOpen(true)}>
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
            <SaveButton state={saveState} dirty={dirty} onClick={save} createLabel={isDraft} />
          </div>
        </div>
      </div>

      <ConfirmDelete
        open={confirmOpen}
        label="banner"
        busy={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </div>
  );
}

// ── Card de bolão ─────────────────────────────────────────────

function CardRow({
  card,
  dragHandlers,
  onChanged,
  onCancelDraft,
}: {
  /** null = rascunho novo. */
  card: HomeBolaoCard | null;
  dragHandlers: ReactDragHandlers;
  onChanged: () => void;
  onCancelDraft?: () => void;
}) {
  const toast = useBolaoToast();
  const isDraft = card === null;
  const [form, setForm] = useState({
    name: card?.name ?? "",
    badge: card?.badge ?? "",
    badgeVariant: card?.badgeVariant ?? ("muted" as "primary" | "muted"),
    dateText: card?.dateText ?? "",
    timeText: card?.timeText ?? "",
    prizeLabel: card?.prizeLabel ?? "",
    prizeUnit: card?.prizeUnit ?? "",
    href: card?.href ?? "",
    isPrimary: card?.isPrimary ?? false,
    enabled: card?.enabled ?? true,
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const dirty = isDraft
    ? form.name.trim() !== "" || form.href.trim() !== ""
    : form.name !== card.name ||
      form.badge !== (card.badge ?? "") ||
      form.badgeVariant !== card.badgeVariant ||
      form.dateText !== (card.dateText ?? "") ||
      form.timeText !== (card.timeText ?? "") ||
      form.prizeLabel !== (card.prizeLabel ?? "") ||
      form.prizeUnit !== (card.prizeUnit ?? "") ||
      form.href !== card.href ||
      form.isPrimary !== card.isPrimary ||
      form.enabled !== card.enabled;

  async function save() {
    setSaveState("saving");
    try {
      const r = await fetch(
        isDraft ? "/api/admin/home-bolao-cards" : `/api/admin/home-bolao-cards/${card.id}`,
        {
          method: isDraft ? "POST" : "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            badge: form.badge || null,
            dateText: form.dateText || null,
            timeText: form.timeText || null,
            prizeLabel: form.prizeLabel || null,
            prizeUnit: form.prizeUnit || null,
          }),
        },
      );
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Falha ao salvar");
      setSaveState("saved");
      toast.success(isDraft ? "Card criado" : "Card salvo");
      onChanged();
    } catch (e) {
      setSaveState("idle");
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function uploadImage(file: File) {
    if (!card) return;
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
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
      toast.success("Logo atualizado");
      onChanged();
    } catch (e) {
      setPreviewUrl(null);
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    if (!card) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/home-bolao-cards/${card.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        throw new Error(d.error ?? "Falha ao excluir");
      }
      toast.success("Card excluído");
      setConfirmOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  }

  const img = previewUrl ?? card?.imageUrl ?? null;

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border bg-[#0d0d0d] p-3 transition sm:flex-row ${
        isDraft
          ? "border-[#B1EB0B]/30 ring-1 ring-[#B1EB0B]/10"
          : dragHandlers.isDragging
            ? "border-[#B1EB0B]/40 opacity-60"
            : "border-white/8"
      } ${!form.enabled && !isDraft ? "opacity-70" : ""}`}
      draggable={!isDraft}
      {...(isDraft ? {} : dragHandlers.rowProps)}
    >
      {!isDraft ? (
        <button
          type="button"
          className="hidden shrink-0 cursor-grab items-center self-stretch px-1 text-white/25 hover:text-white/50 active:cursor-grabbing sm:flex"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="size-4" />
        </button>
      ) : null}

      <div className="relative flex w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black sm:w-28">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={form.name} className="h-20 w-full object-contain" />
        ) : (
          <div className="flex h-20 w-full flex-col items-center justify-center gap-1 text-white/25">
            <ImageIcon className="size-4" />
            <span className="text-[10px] text-center">{isDraft ? "Salve p/ logo" : "Sem logo"}</span>
          </div>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="size-4 animate-spin text-[#B1EB0B]" />
          </div>
        ) : null}
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3">
        {isDraft ? (
          <span className="col-span-2 inline-flex w-fit items-center rounded-full bg-[#B1EB0B]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#B1EB0B]">
            Novo card
          </span>
        ) : null}
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
        <div className="col-span-2">
          <label className={LABEL}>Link (href)</label>
          <input className={FIELD} value={form.href} onChange={(e) => set("href", e.target.value)} placeholder="/tickets?bolao=extra" />
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} disabled={saveState === "saving"} />
              <span className="text-[12px] font-semibold text-white/60">{form.enabled ? "Visível" : "Oculto"}</span>
            </div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-white/60">
              <input type="checkbox" checked={form.isPrimary} onChange={(e) => set("isPrimary", e.target.checked)} />
              Destaque
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && !isDraft ? <span className="text-[11px] font-semibold text-amber-300/80">Não salvo</span> : null}
            {isDraft ? (
              <button type="button" className={BTN_GHOST} onClick={onCancelDraft}>
                Cancelar
              </button>
            ) : (
              <>
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
                <button type="button" className={BTN_GHOST} disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" /> Logo
                </button>
                <button type="button" className={BTN_DANGER} onClick={() => setConfirmOpen(true)}>
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
            <SaveButton state={saveState} dirty={dirty} onClick={save} createLabel={isDraft} />
          </div>
        </div>
      </div>

      <ConfirmDelete
        open={confirmOpen}
        label="card"
        busy={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </div>
  );
}

// ── Drag-and-drop helper (HTML5 nativo, sem dependência) ──────

type ReactDragHandlers = {
  isDragging: boolean;
  rowProps: {
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
};

/** Handlers neutros para o rascunho (não arrastável). */
const NO_DRAG: ReactDragHandlers = {
  isDragging: false,
  rowProps: {
    onDragStart: () => {},
    onDragOver: () => {},
    onDrop: () => {},
    onDragEnd: () => {},
  },
};

function useReorder<T extends { id: string }>(
  items: T[],
  onPersist: (orderedIds: string[]) => void,
): { ordered: T[]; handlersFor: (index: number) => ReactDragHandlers } {
  const [ordered, setOrdered] = useState(items);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setOrdered(items);
  }, [items]);

  const handlersFor = (index: number): ReactDragHandlers => ({
    isDragging: dragIndex === index,
    rowProps: {
      onDragStart: () => setDragIndex(index),
      onDragOver: (e) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        setOrdered((prev) => {
          const next = [...prev];
          const [moved] = next.splice(dragIndex, 1);
          next.splice(index, 0, moved!);
          return next;
        });
        setDragIndex(index);
      },
      onDrop: (e) => e.preventDefault(),
      onDragEnd: () => {
        setDragIndex(null);
        onPersist(ordered.map((i) => i.id));
      },
    },
  });

  return { ordered, handlersFor };
}

// ── Tela ──────────────────────────────────────────────────────

export function AdminBannersClient() {
  const toast = useBolaoToast();
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [cards, setCards] = useState<HomeBolaoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftBanner, setDraftBanner] = useState(false);
  const [draftCard, setDraftCard] = useState(false);

  const loadAll = useCallback(async () => {
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
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const persistBannerOrder = useCallback(
    async (ids: string[]) => {
      try {
        const r = await fetch("/api/admin/home-banners/reorder", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!r.ok) throw new Error();
        toast.success("Ordem atualizada");
      } catch {
        toast.error("Falha ao reordenar");
        void loadAll();
      }
    },
    [toast, loadAll],
  );

  const persistCardOrder = useCallback(
    async (ids: string[]) => {
      try {
        const r = await fetch("/api/admin/home-bolao-cards/reorder", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!r.ok) throw new Error();
        toast.success("Ordem atualizada");
      } catch {
        toast.error("Falha ao reordenar");
        void loadAll();
      }
    },
    [toast, loadAll],
  );

  const bannerReorder = useReorder(banners, persistBannerOrder);
  const cardReorder = useReorder(cards, persistCardOrder);

  // Após criar/salvar com sucesso, fecha o rascunho e recarrega a lista.
  const afterBannerSaved = useCallback(() => {
    setDraftBanner(false);
    void loadAll();
  }, [loadAll]);
  const afterCardSaved = useCallback(() => {
    setDraftCard(false);
    void loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-white/40">
        <Loader2 className="size-5 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-black text-white">Carrossel principal</h2>
          <button type="button" className={BTN_PRIMARY} disabled={draftBanner} onClick={() => setDraftBanner(true)}>
            <Plus className="size-3.5" /> Novo banner
          </button>
        </div>
        <p className="mb-4 text-[12px] text-white/35">
          Arraste pelo <GripVertical className="inline size-3.5 align-text-bottom" /> para reordenar. A ordem é salva automaticamente.
        </p>
        {bannerReorder.ordered.length === 0 && !draftBanner ? (
          <EmptyState text="Nenhum banner cadastrado — a home mostra os banners padrão." />
        ) : (
          <div className="flex flex-col gap-3">
            {draftBanner ? (
              <BannerRow
                banner={null}
                dragHandlers={NO_DRAG}
                onChanged={afterBannerSaved}
                onCancelDraft={() => setDraftBanner(false)}
              />
            ) : null}
            {bannerReorder.ordered.map((b, i) => (
              <BannerRow key={b.id} banner={b} dragHandlers={bannerReorder.handlersFor(i)} onChanged={loadAll} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-black text-white">Cards · Próximos Bolões</h2>
          <button type="button" className={BTN_PRIMARY} disabled={draftCard} onClick={() => setDraftCard(true)}>
            <Plus className="size-3.5" /> Novo card
          </button>
        </div>
        <p className="mb-4 text-[12px] text-white/35">
          Arraste pelo <GripVertical className="inline size-3.5 align-text-bottom" /> para reordenar.
        </p>
        {cardReorder.ordered.length === 0 && !draftCard ? (
          <EmptyState text="Nenhum card cadastrado — a home mostra os cards padrão." />
        ) : (
          <div className="flex flex-col gap-3">
            {draftCard ? (
              <CardRow
                card={null}
                dragHandlers={NO_DRAG}
                onChanged={afterCardSaved}
                onCancelDraft={() => setDraftCard(false)}
              />
            ) : null}
            {cardReorder.ordered.map((c, i) => (
              <CardRow key={c.id} card={c} dragHandlers={cardReorder.handlersFor(i)} onChanged={loadAll} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
      <ImageIcon className="size-6 text-white/20" />
      <p className="text-[13px] text-white/40">{text}</p>
    </div>
  );
}
