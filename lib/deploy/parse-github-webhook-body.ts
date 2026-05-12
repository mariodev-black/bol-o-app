import zlib from "node:zlib";

type ParseOk = { ok: true; json: Record<string, unknown> };
type ParseErr = {
  ok: false;
  error: string;
  previewHex: string;
  contentEncoding: string;
  previewUtf8: string;
};

export type ParseGithubWebhookBodyResult = ParseOk | ParseErr;

/**
 * GitHub pode enviar:
 * - `application/json` — corpo é o JSON do evento
 * - `application/x-www-form-urlencoded` — campo `payload` com JSON URL-encoded (opção no painel do GitHub)
 *
 * Além disso, gzip no Content-Encoding ou magic bytes 1f 8b.
 */
function tryParseJsonOrGithubForm(text: string, contentType: string | null): { ok: true; json: Record<string, unknown> } | null {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  const ct = (contentType ?? "").toLowerCase();
  const looksForm =
    ct.includes("application/x-www-form-urlencoded") || trimmed.startsWith("payload=");

  if (looksForm) {
    const params = new URLSearchParams(trimmed);
    const payload = params.get("payload");
    if (payload) {
      try {
        return { ok: true, json: JSON.parse(payload) as Record<string, unknown> };
      } catch {
        return null;
      }
    }
  }

  try {
    return { ok: true, json: JSON.parse(trimmed) as Record<string, unknown> };
  } catch {
    return null;
  }
}

export function parseGithubWebhookBody(
  buf: Buffer,
  contentEncoding: string | null,
  contentType: string | null
): ParseGithubWebhookBodyResult {
  const enc = (contentEncoding ?? "").toLowerCase();
  const looksGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;

  const candidates: { label: string; text: string }[] = [];

  if (enc.includes("gzip") || looksGzip) {
    try {
      candidates.push({ label: "gunzip(header|magic)", text: zlib.gunzipSync(buf).toString("utf8") });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `gunzip falhou: ${msg}`,
        previewHex: buf.subarray(0, 48).toString("hex"),
        contentEncoding: enc || "(vazio)",
        previewUtf8: "",
      };
    }
  }

  candidates.push({ label: "utf8-raw", text: buf.toString("utf8") });

  if (!enc.includes("gzip") && !looksGzip) {
    try {
      candidates.push({ label: "gunzip-fallback", text: zlib.gunzipSync(buf).toString("utf8") });
    } catch {
      /* corpo não era gzip */
    }
  }

  let lastErr = "";
  let previewUtf8 = "";
  for (const { label, text } of candidates) {
    const parsed = tryParseJsonOrGithubForm(text, contentType);
    if (parsed) {
      return { ok: true, json: parsed.json };
    }
    lastErr = `${label}: JSON ou campo payload inválido`;
    previewUtf8 = text.slice(0, 160).replace(/[\u0000-\u001f\\]/g, " ");
  }

  return {
    ok: false,
    error: lastErr,
    previewHex: buf.subarray(0, 48).toString("hex"),
    contentEncoding: enc || (looksGzip ? "gzip(magic)" : "(vazio)"),
    previewUtf8,
  };
}
