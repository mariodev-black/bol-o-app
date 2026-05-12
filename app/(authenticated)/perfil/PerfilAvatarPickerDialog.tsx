"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useState } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import type { AuthUser } from "@/app/shared/AuthContext";
import {
  prepareAvatarImageForUpload,
  prepareAvatarErrorMessage,
  type PrepareAvatarErrorCode,
} from "@/lib/client/avatar-upload-prepare";
import { AVATAR_PRESET_IMAGES, clampAvatarIndex } from "@/lib/user/avatar-presets";
import { avatarUploadPublicUrl, isStoredAvatarUploadFilename } from "@/lib/user/avatar-filename";

type TabId = "presets" | "foto";

type Props = {
  open: boolean;
  onClose: () => void;
  currentIndex: number;
  uploadFilename: string | null;
  onSaved: (user: AuthUser) => void;
};

export function PerfilAvatarPickerDialog({
  open,
  onClose,
  currentIndex,
  uploadFilename,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("presets");
  /** Só durante upload de foto: permite mensagem fluida sem bloquear pintura. */
  const [uploadPhase, setUploadPhase] = useState<null | "preparing" | "uploading">(null);
  const fileInputId = useId();

  const safeUpload = uploadFilename && isStoredAvatarUploadFilename(uploadFilename) ? uploadFilename : null;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUploadPhase(null);
    setTab("presets");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, saving]);

  const pickPreset = useCallback(
    async (index: number) => {
      const idx = clampAvatarIndex(index);
      if (!safeUpload && idx === clampAvatarIndex(currentIndex)) {
        onClose();
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const r = await fetch("/api/user/avatar", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarIndex: idx }),
        });
        const data = (await r.json()) as { error?: string; user?: AuthUser };
        if (!r.ok || !data.user) {
          setError(typeof data.error === "string" ? data.error : "Não foi possível salvar.");
          return;
        }
        onSaved(data.user);
        onClose();
      } catch {
        setError("Erro de rede. Tente novamente.");
      } finally {
        setSaving(false);
      }
    },
    [currentIndex, onClose, onSaved, safeUpload]
  );

  const clearUpload = useCallback(async () => {
    if (!safeUpload) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/user/avatar", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearCustomAvatar: true }),
      });
      const data = (await r.json()) as { error?: string; user?: AuthUser };
      if (!r.ok || !data.user) {
        setError(typeof data.error === "string" ? data.error : "Não foi possível remover.");
        return;
      }
      onSaved(data.user);
      onClose();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, [onClose, onSaved, safeUpload]);

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setSaving(true);
      setError(null);
      setUploadPhase("preparing");
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      try {
        let prepared: File;
        try {
          prepared = await prepareAvatarImageForUpload(file);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          const code: PrepareAvatarErrorCode =
            msg === "not_image" || msg === "too_big_pick" || msg === "decode" || msg === "export"
              ? msg
              : "decode";
          setError(prepareAvatarErrorMessage(code));
          return;
        }
        setUploadPhase("uploading");
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        const fd = new FormData();
        fd.set("file", prepared);
        const r = await fetch("/api/user/avatar-upload", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const data = (await r.json()) as { error?: string; user?: AuthUser };
        if (!r.ok || !data.user) {
          setError(typeof data.error === "string" ? data.error : "Não foi possível enviar a foto.");
          return;
        }
        onSaved(data.user);
        onClose();
      } catch {
        setError("Erro de rede. Tente novamente.");
      } finally {
        setUploadPhase(null);
        setSaving(false);
      }
    },
    [onClose, onSaved]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perfil-avatar-dialog-titulo"
    >
      <button
        type="button"
        className="animate-perfil-avatar-overlay-in absolute inset-0 z-0 bg-black/80 backdrop-blur-[2px]"
        aria-label="Fechar"
        disabled={saving}
        onClick={() => !saving && onClose()}
      />
      <div className="animate-perfil-avatar-sheet-in relative z-10 flex max-h-[min(92dvh,620px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#101010] shadow-[0_-12px_48px_rgba(0,0,0,0.55)] sm:max-h-[88vh] sm:rounded-2xl sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <h2
            id="perfil-avatar-dialog-titulo"
            className="font-helvetica-now-display text-left text-[15px] font-black uppercase tracking-wide text-white"
          >
            Alterar avatar
          </h2>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="size-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-white/10 px-3 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => setTab("presets")}
            className={`min-h-10 flex-1 rounded-t-lg py-2 text-[11px] font-black uppercase tracking-wide transition-colors ${
              tab === "presets"
                ? "border-b-2 border-primary text-primary"
                : "border-b-2 border-transparent text-white/45 hover:text-white/70"
            }`}
          >
            Oficiais
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setTab("foto")}
            className={`min-h-10 flex-1 rounded-t-lg py-2 text-[11px] font-black uppercase tracking-wide transition-colors ${
              tab === "foto"
                ? "border-b-2 border-primary text-primary"
                : "border-b-2 border-transparent text-white/45 hover:text-white/70"
            }`}
          >
            Minha foto
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {tab === "presets" ? (
            <>
              <p className="text-center text-[12px] font-medium leading-relaxed text-white/55">
                Avatares oficiais do Bolão. Ao escolher um, a foto enviada por você é removida.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-2">
                {AVATAR_PRESET_IMAGES.map((src, index) => {
                  const selected = !safeUpload && clampAvatarIndex(currentIndex) === index;
                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={saving}
                      onClick={() => void pickPreset(index)}
                      className={`relative aspect-square overflow-hidden rounded-2xl border-2 transition-all active:scale-[0.97] disabled:opacity-60 ${
                        selected
                          ? "border-primary shadow-[0_0_20px_rgba(177,235,11,0.35)] ring-2 ring-primary/30"
                          : "border-white/10 bg-black/40 hover:border-primary/40"
                      }`}
                      aria-label={`Avatar oficial ${index + 1}`}
                      aria-pressed={selected}
                    >
                      <Image src={src} alt="" fill className="object-cover" sizes="120px" />
                      {selected ? (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-black uppercase text-[#0E141B]">
                          Atual
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-[12px] font-medium leading-relaxed text-white/55">
                Você pode escolher fotos grandes (até ~50 MB); o app otimiza antes de enviar. A foto fica salva na sua conta.
              </p>
              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={saving}
                onChange={onFileChange}
              />
              <div className="mt-4 flex min-h-[280px] flex-col items-center justify-center gap-3">
                {safeUpload ? (
                  <div className="relative size-32 shrink-0 overflow-hidden rounded-2xl border-2 border-primary/40 shadow-[0_0_24px_rgba(177,235,11,0.2)]">
                    <Image
                      src={avatarUploadPublicUrl(safeUpload)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="128px"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex size-32 shrink-0 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/3 text-white/35">
                    <ImagePlus className="size-10" strokeWidth={1.5} />
                  </div>
                )}
                <label
                  htmlFor={fileInputId}
                  className={`inline-flex h-11 w-full max-w-xs cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/12 px-4 text-[12px] font-black uppercase tracking-wide text-primary transition-colors hover:bg-primary/18 ${
                    saving ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <ImagePlus className="size-4" strokeWidth={2.2} />
                  Escolher da galeria
                </label>
                {safeUpload ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void clearUpload()}
                    className="inline-flex h-10 w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 text-[11px] font-black uppercase tracking-wide text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" strokeWidth={2.2} />
                    Remover minha foto
                  </button>
                ) : null}
              </div>
            </>
          )}

          {error ? <p className="mt-4 text-center text-[12px] font-semibold text-red-400">{error}</p> : null}
          {saving ? (
            <p className="mt-2 text-center text-[11px] font-medium text-primary">
              {uploadPhase === "preparing"
                ? "Otimizando imagem…"
                : uploadPhase === "uploading"
                  ? "Enviando…"
                  : "Salvando…"}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
