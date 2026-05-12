/**
 * Pré-processamento de avatar no navegador (redimensiona + JPEG) para upload rápido e leve.
 * Não importar em rotas ou código de servidor.
 */

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.85;
/** Limite do arquivo escolhido na galeria antes de tentar decodificar (evita OOM no celular). */
export const AVATAR_CLIENT_MAX_PICK_BYTES = 52 * 1024 * 1024;

export type PrepareAvatarErrorCode = "not_image" | "too_big_pick" | "decode" | "export";

export function prepareAvatarErrorMessage(code: PrepareAvatarErrorCode): string {
  switch (code) {
    case "not_image":
      return "Selecione um arquivo de imagem.";
    case "too_big_pick":
      return "Imagem muito grande para processar neste aparelho. Escolha outra foto (até ~50 MB) ou uma com resolução menor.";
    case "decode":
      return "Não foi possível abrir esta imagem. Tente JPG, PNG ou WebP.";
    case "export":
      return "Não foi possível preparar o arquivo. Tente outra imagem.";
    default:
      return "Não foi possível preparar a imagem.";
  }
}

function isKnownCode(msg: string): msg is PrepareAvatarErrorCode {
  return msg === "not_image" || msg === "too_big_pick" || msg === "decode" || msg === "export";
}

/**
 * Redimensiona para no máximo ~1280px no maior lado e exporta JPEG.
 * Reduz muito o tamanho enviado ao servidor (fluxo rápido no 4G/Wi‑Fi).
 */
export async function prepareAvatarImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("not_image");
  }
  if (file.size > AVATAR_CLIENT_MAX_PICK_BYTES) {
    throw new Error("too_big_pick");
  }

  let src: ImageBitmap | null = null;
  try {
    try {
      src = await createImageBitmap(file, { resizeWidth: MAX_EDGE } as ImageBitmapOptions);
    } catch {
      src = await createImageBitmap(file);
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(src.width, src.height, 1));
    const tw = Math.max(1, Math.round(src.width * scale));
    const th = Math.max(1, Math.round(src.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("export");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(src, 0, 0, tw, th);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) {
      throw new Error("export");
    }
    return new File([blob], "avatar.jpg", { type: "image/jpeg", lastModified: Date.now() });
  } catch (e) {
    if (e instanceof Error && isKnownCode(e.message)) {
      throw e;
    }
    throw new Error("decode");
  } finally {
    if (src) {
      try {
        src.close();
      } catch {
        /* ignore */
      }
    }
  }
}
