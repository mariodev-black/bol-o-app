import type { IncomingMessage } from "node:http";
import https from "node:https";
import { URL } from "node:url";
import {
  fyhubAccountsApiBaseUrl,
  fyhubRejectUnauthorized,
  loadFyhubAccountsMtlsMaterials,
} from "@/lib/payments/fyhub/config";

async function readBody(res: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of res) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getMtlsAgent(): https.Agent {
  const { cert, key } = loadFyhubAccountsMtlsMaterials();
  return new https.Agent({
    cert,
    key,
    rejectUnauthorized: fyhubRejectUnauthorized(),
    keepAlive: true,
  });
}

/** HTTPS com mTLS da API Contas Fyhub. */
export async function fyhubAccountsFetch(
  url: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const target = typeof url === "string" ? new URL(url) : url;
  if (target.protocol !== "https:") {
    throw new Error(`Fyhub Contas exige HTTPS (recebido ${target.protocol})`);
  }

  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.headers) {
    const h = new Headers(init.headers);
    h.forEach((value, key) => {
      headers[key] = value;
    });
  }

  const bodyBuffer =
    init.body == null
      ? undefined
      : typeof init.body === "string"
        ? Buffer.from(init.body, "utf8")
        : Buffer.from(String(init.body), "utf8");

  if (bodyBuffer && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (bodyBuffer) headers["Content-Length"] = String(bodyBuffer.length);

  const agent = getMtlsAgent();

  return new Promise<Response>((resolve, reject) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
        agent,
      },
      (res) => {
        void (async () => {
          try {
            const buf = await readBody(res);
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (value == null) continue;
              if (Array.isArray(value)) for (const v of value) responseHeaders.append(key, v);
              else responseHeaders.set(key, value);
            }
            resolve(
              new Response(new Uint8Array(buf), {
                status: res.statusCode ?? 0,
                statusText: res.statusMessage ?? "",
                headers: responseHeaders,
              }),
            );
          } catch (error) {
            reject(error);
          }
        })();
      },
    );
    req.on("error", reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

export function fyhubAccountsUrl(pathname: string): string {
  const base = fyhubAccountsApiBaseUrl().replace(/\/$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}`;
}
