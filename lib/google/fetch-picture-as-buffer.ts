/** Limite ao baixar foto de perfil OAuth (ex.: Google). */
const MAX_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;

function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function normalizeMime(headerMime: string | null, buf: Buffer): string | null {
  const raw = headerMime?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (raw && raw.startsWith("image/") && raw !== "application/octet-stream") return raw;
  return sniffImageMime(buf);
}

/**
 * Baixa uma URL HTTPS de imagem (ex.: `picture` do Google) com timeout e limite de tamanho.
 */
export async function fetchPictureAsBuffer(url: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const u = url.trim();
  if (!u.startsWith("https://")) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(u, {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": "BolaoDoMilhaoOAuth/1.0",
      },
    });
    if (!res.ok) return null;
    const lenHdr = res.headers.get("content-length");
    if (lenHdr) {
      const n = Number.parseInt(lenHdr, 10);
      if (Number.isFinite(n) && n > MAX_BYTES) return null;
    }
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;
    const mime = normalizeMime(res.headers.get("content-type"), buffer);
    if (!mime) return null;
    return { buffer, mime };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
