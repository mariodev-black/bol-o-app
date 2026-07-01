/**
 * Redimensiona imagens de logo/banner no navegador antes do upload (menor payload, mais rápido).
 */

const LOGO_MAX_EDGE = 512;
const BANNER_MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;
const MAX_PICK_BYTES = 52 * 1024 * 1024;

export async function prepareBolaoImageForUpload(
  file: File,
  kind: "logo" | "banner" = "logo",
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }
  if (file.size > MAX_PICK_BYTES) {
    throw new Error("Imagem muito grande. Use até ~50 MB ou menor resolução.");
  }

  const maxEdge = kind === "banner" ? BANNER_MAX_EDGE : LOGO_MAX_EDGE;
  let src: ImageBitmap | null = null;

  try {
    try {
      src = await createImageBitmap(file, { resizeWidth: maxEdge } as ImageBitmapOptions);
    } catch {
      src = await createImageBitmap(file);
    }

    const scale = Math.min(1, maxEdge / Math.max(src.width, src.height, 1));
    const tw = Math.max(1, Math.round(src.width * scale));
    const th = Math.max(1, Math.round(src.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Não foi possível processar a imagem.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(src, 0, 0, tw, th);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) throw new Error("Não foi possível exportar a imagem.");

    const base = file.name.replace(/\.[^.]+$/, "") || "bolao";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    src?.close?.();
  }
}
