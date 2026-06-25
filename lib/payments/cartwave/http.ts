import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { URL } from "node:url";
import { cartwaveOutboundIpv4 } from "@/lib/payments/cartwave/config";

let httpsAgent: https.Agent | null = null;

function getHttpsAgent(): https.Agent {
  if (!httpsAgent) {
    const localAddress = cartwaveOutboundIpv4() ?? undefined;
    httpsAgent = new https.Agent({
      keepAlive: true,
      localAddress,
      lookup(hostname, _options, callback) {
        dns.lookup(hostname, { family: 4, all: false }, callback);
      },
    });
  }
  return httpsAgent;
}

async function readBody(res: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of res) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Requisições Cartwave sempre saem por IPv4 (whitelist WAF). */
export async function cartwaveFetch(
  url: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const parsed = new URL(url.toString());
  const isHttps = parsed.protocol === "https:";
  const lib = isHttps ? https : http;

  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  const body =
    init.body == null
      ? null
      : typeof init.body === "string"
        ? init.body
        : init.body instanceof Uint8Array
          ? Buffer.from(init.body)
          : Buffer.from(await new Response(init.body).arrayBuffer());

  if (body && !headers.has("content-length")) {
    headers.set("content-length", String(Buffer.byteLength(body)));
  }

  return new Promise<Response>((resolve, reject) => {
    const req: ClientRequest = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: Object.fromEntries(headers.entries()),
        agent: isHttps ? getHttpsAgent() : undefined,
      },
      async (res) => {
        try {
          const buf = await readBody(res);
          resolve(
            new Response(new Uint8Array(buf), {
              status: res.statusCode ?? 500,
              statusText: res.statusMessage ?? "",
              headers: res.headers as HeadersInit,
            }),
          );
        } catch (err) {
          reject(err);
        }
      },
    );

    req.on("error", reject);

    if (init.signal) {
      if (init.signal.aborted) {
        req.destroy();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      init.signal.addEventListener(
        "abort",
        () => {
          req.destroy();
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    }

    if (body) req.write(body);
    req.end();
  });
}
