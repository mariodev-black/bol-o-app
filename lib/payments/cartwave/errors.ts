export type CartwaveHttpFailure = {
  status: number;
  statusText: string;
  contentType: string | null;
  bodyPreview: string;
  isJson: boolean;
  parsed: Record<string, unknown> | null;
  cloudfrontBlocked: boolean;
  cloudFrontPop: string | null;
  headers: Record<string, string>;
};

export function isCloudFrontBlockResponse(
  status: number,
  contentType: string | null,
  body: string,
): boolean {
  if (status !== 403) return false;
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("text/html")) return true;
  return body.includes("CloudFront") || body.includes("The request could not be satisfied");
}

export function maskSecret(value: string, show = 4): string {
  const t = value.trim();
  if (!t) return "(vazio)";
  if (t.length <= show * 2) return "*".repeat(t.length);
  return `${t.slice(0, show)}…${t.slice(-show)} (${t.length} chars)`;
}

export function buildCartwaveFailureMessage(failure: CartwaveHttpFailure, context: string): string {
  if (failure.cloudfrontBlocked) {
    return [
      `Cartwave bloqueou a requisicao no CloudFront/WAF (${context}, HTTP 403).`,
      "A requisicao nao chegou na API — normalmente o IP IPv4 do servidor precisa ser liberado pela Cartwave.",
      "Se a Cartwave reportar IPv6, configure CARTWAVE_OUTBOUND_IPV4 no .env.",
      failure.cloudFrontPop ? `CloudFront POP: ${failure.cloudFrontPop}.` : "",
      "Rode: npm run cartwave:debug — ou GET /api/admin/cartwave/debug (admin).",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const parsed = failure.parsed;
  if (parsed) {
    const parts = [
      typeof parsed.error_description === "string" ? parsed.error_description : null,
      typeof parsed.detail === "string" ? parsed.detail : null,
      typeof parsed.error === "string" ? parsed.error : null,
      typeof parsed.erro_descriptor === "string" ? parsed.erro_descriptor : null,
      typeof parsed.new_erro_descriptor === "string" ? parsed.new_erro_descriptor : null,
    ].filter(Boolean);
    if (parts.length) return `${parts[0]} (${context}, HTTP ${failure.status})`;
  }

  if (failure.bodyPreview && !failure.isJson) {
    return `${failure.bodyPreview.slice(0, 200)} (${context}, HTTP ${failure.status})`;
  }

  return `${context} falhou (HTTP ${failure.status})`;
}

export async function readCartwaveHttpFailure(res: Response): Promise<CartwaveHttpFailure> {
  const text = await res.text();
  const contentType = res.headers.get("content-type");
  let parsed: Record<string, unknown> | null = null;
  let isJson = false;
  try {
    const j = JSON.parse(text) as unknown;
    if (j && typeof j === "object" && !Array.isArray(j)) {
      parsed = j as Record<string, unknown>;
      isJson = true;
    }
  } catch {
    /* html or plain text */
  }

  const headers: Record<string, string> = {};
  for (const name of ["via", "x-cache", "x-amz-cf-pop", "x-amz-cf-id", "server"]) {
    const v = res.headers.get(name);
    if (v) headers[name] = v;
  }

  return {
    status: res.status,
    statusText: res.statusText,
    contentType,
    bodyPreview: text.slice(0, 500),
    isJson,
    parsed,
    cloudfrontBlocked: isCloudFrontBlockResponse(res.status, contentType, text),
    cloudFrontPop: res.headers.get("x-amz-cf-pop"),
    headers,
  };
}
