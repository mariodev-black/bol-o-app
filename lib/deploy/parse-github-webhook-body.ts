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
 * GitHub manda JSON; em alguns proxies o corpo vem gzip sem header claro.
 * Ordem: gzip explícito / magic gzip → UTF-8 direto → tentativa gzip de fallback.
 */
export function parseGithubWebhookBody(buf: Buffer, contentEncoding: string | null): ParseGithubWebhookBodyResult {
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
    try {
      const trimmed = text.replace(/^\uFEFF/, "").trim();
      return { ok: true, json: JSON.parse(trimmed) as Record<string, unknown> };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastErr = `${label}: ${msg}`;
      previewUtf8 = text.slice(0, 160).replace(/[\u0000-\u001f\\]/g, " ");
    }
  }

  return {
    ok: false,
    error: lastErr,
    previewHex: buf.subarray(0, 48).toString("hex"),
    contentEncoding: enc || (looksGzip ? "gzip(magic)" : "(vazio)"),
    previewUtf8,
  };
}
