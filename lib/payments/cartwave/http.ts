import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { URL } from "node:url";
import { cartwaveOutboundIpv4, isCartwaveConfigured } from "@/lib/payments/cartwave/config";
import { isIpv4AssignedLocally } from "@/lib/payments/cartwave/network-diagnostics";

/** Preferir IPv4 em todo o processo Node (Happy Eyeballs / IPv6-first). */
dns.setDefaultResultOrder("ipv4first");

let httpsAgent: https.Agent | null = null;
let httpsAgentBindKey: string | null = null;
let bindFallbackWarned = false;

function buildHttpsAgent(bindIpv4: string | undefined): https.Agent {
  return new https.Agent({
    keepAlive: true,
    family: 4,
    localAddress: bindIpv4,
    lookup(hostname, _options, callback) {
      dns.lookup(hostname, { family: 4, all: false }, callback);
    },
  });
}

function resolveOutboundBindIpv4(): string | undefined {
  const configured = cartwaveOutboundIpv4();
  if (!configured) {
    if (isCartwaveConfigured() && process.env.NODE_ENV === "production") {
      throw new Error(
        "CARTWAVE_OUTBOUND_IPV4 obrigatorio em producao — sem bind as requisicoes saem por IPv6 e sao bloqueadas pelo WAF da Cartwave.",
      );
    }
    return undefined;
  }

  if (!isIpv4AssignedLocally(configured)) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `CARTWAVE_OUTBOUND_IPV4=${configured} nao esta atribuido a esta maquina (bind EADDRNOTAVAIL). ` +
          "Rode npm run cartwave:debug no servidor de producao e confirme o IPv4 fixo whitelisted.",
      );
    }
    if (!bindFallbackWarned) {
      bindFallbackWarned = true;
      console.warn(
        `[cartwave/http] CARTWAVE_OUTBOUND_IPV4=${configured} nao e local — dev: IPv4 sem bind (teste auth no servidor de producao).`,
      );
    }
    return undefined;
  }

  return configured;
}

function getHttpsAgent(): https.Agent {
  const bindIpv4 = resolveOutboundBindIpv4();
  const bindKey = bindIpv4 ?? "__ipv4-no-bind__";
  if (httpsAgent && httpsAgentBindKey === bindKey) {
    return httpsAgent;
  }
  httpsAgent = buildHttpsAgent(bindIpv4);
  httpsAgentBindKey = bindKey;
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
  const bindIpv4 = isHttps ? resolveOutboundBindIpv4() : undefined;

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
        family: 4,
        localAddress: bindIpv4,
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
