/** Limite e formatos aceitos para imagens de banner/card da home. */
export const HOME_IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const ACCEPTED_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export type ParsedHomeImage = { buffer: Buffer; mime: string };

/**
 * Lê o campo `file` de um FormData de upload e valida tipo/tamanho.
 * Lança Error com mensagens previsíveis: "no_file" | "unsupported_mime" | "invalid_size".
 */
export async function parseHomeImageUpload(form: FormData): Promise<ParsedHomeImage> {
  const file = form.get("file");
  if (!file || typeof file === "string") throw new Error("no_file");
  const mimeRaw = (file.type || "").toLowerCase();
  const mime = mimeRaw === "image/jpg" ? "image/jpeg" : mimeRaw;
  if (!ACCEPTED_MIMES.has(mimeRaw)) throw new Error("unsupported_mime");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0 || buffer.length > HOME_IMAGE_MAX_BYTES) {
    throw new Error("invalid_size");
  }
  return { buffer, mime };
}

export function homeImageUploadErrorResponse(message: string): {
  error: string;
  status: number;
} | null {
  if (message === "no_file") return { error: "Envie o arquivo no campo file", status: 400 };
  if (message === "unsupported_mime")
    return { error: "Formato não aceito. Use JPG, PNG ou WebP.", status: 400 };
  if (message === "invalid_size")
    return {
      error: `Imagem inválida ou maior que ${Math.round(HOME_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
      status: 400,
    };
  return null;
}
