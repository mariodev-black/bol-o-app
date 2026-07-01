"use client";

import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { prepareBolaoImageForUpload } from "@/lib/client/bolao-image-upload-prepare";

type Props = {
  label: string;
  hint?: string;
  valueUrl: string;
  onChangeUrl: (url: string) => void;
  previewSize?: "logo" | "banner";
};

export function BolaoImageUpload({
  label,
  hint,
  valueUrl,
  onChangeUrl,
  previewSize = "logo",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewSrc = localPreview || valueUrl || null;
  const kind = previewSize === "banner" ? "banner" : "logo";

  useEffect(() => {
    return () => {
      if (localPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  async function uploadFile(file: File) {
    setError(null);
    const blobUrl = URL.createObjectURL(file);
    setLocalPreview(blobUrl);
    setUploading(true);
    try {
      const prepared = await prepareBolaoImageForUpload(file, kind);
      const fd = new FormData();
      fd.append("file", prepared);
      const r = await fetch("/api/admin/boloes/definitions/media", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const d = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !d.url) throw new Error(d.error ?? "Falha no upload");
      onChangeUrl(d.url);
      if (localPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(localPreview);
      }
      setLocalPreview(null);
    } catch (e) {
      if (blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
      setLocalPreview(null);
      setError(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    if (localPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(localPreview);
    }
    setLocalPreview(null);
    setError(null);
    onChangeUrl("");
  }

  const previewClass =
    previewSize === "banner"
      ? "h-28 w-full max-w-md"
      : "size-24 sm:size-28";

  return (
    <div className="space-y-3">
      <span className="text-[11px] font-medium uppercase tracking-widest text-white/35">
        {label}
      </span>

      <div className="flex flex-wrap items-start gap-4">
        <div
          className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-white/10 bg-[#080808] ${previewClass}`}
        >
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              className="max-h-full max-w-full object-contain p-2"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-white/25">
              <ImageIcon className="size-7" />
              <span className="text-[10px] font-medium">Sem imagem</span>
            </div>
          )}
          {uploading ? (
            <div className="absolute bottom-1.5 right-1.5 rounded-full bg-black/80 p-1">
              <Loader2 className="size-3.5 animate-spin text-primary" />
            </div>
          ) : null}
        </div>

        <div className="flex min-w-[180px] flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/12 bg-white/5 px-4 py-2.5 text-[12px] font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            <Upload className="size-3.5" />
            {uploading
              ? "Enviando…"
              : valueUrl || localPreview
                ? "Trocar imagem"
                : "Importar imagem"}
          </button>
          {(valueUrl || localPreview) && !uploading ? (
            <button
              type="button"
              onClick={clearImage}
              className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-white/8 px-3 py-2 text-[12px] font-medium text-white/45 hover:text-white/70"
            >
              <X className="size-3.5" />
              Remover
            </button>
          ) : null}
          {hint ? <p className="text-[11px] leading-relaxed text-white/30">{hint}</p> : null}
          {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
