import {
  cartwaveApiBaseUrl,
  cartwaveClientId,
  cartwaveClientSecret,
  cartwaveHmacKey,
  cartwaveOutboundIpv4,
  cartwaveSourceAccountBranch,
  cartwaveSourceAccountNumber,
  isCartwaveConfigured,
} from "@/lib/payments/cartwave/config";
import { buildCartwaveFailureMessage, maskSecret, readCartwaveHttpFailure } from "@/lib/payments/cartwave/errors";
import { cartwaveFetch } from "@/lib/payments/cartwave/http";
import {
  runCartwaveNetworkDiagnostics,
  type CartwaveNetworkDiagnostics,
} from "@/lib/payments/cartwave/network-diagnostics";

export type CartwaveDebugReport = {
  configured: boolean;
  outboundIp: string | null;
  network: CartwaveNetworkDiagnostics;
  env: {
    apiBaseUrl: string;
    outboundIpv4: string | null;
    clientId: string;
    clientSecret: string;
    hmacKey: string;
    sourceBranch: string;
    sourceAccount: string;
    cashoutPath: string;
  };
  auth: {
    url: string;
    ok: boolean;
    httpStatus: number | null;
    elapsedMs: number | null;
    cloudfrontBlocked: boolean;
    cloudFrontPop: string | null;
    tokenPreview: string | null;
    error: string | null;
    responseHeaders: Record<string, string>;
    bodyPreview: string | null;
  };
  hints: string[];
};

export async function runCartwaveDebugReport(): Promise<CartwaveDebugReport> {
  const baseUrl = cartwaveApiBaseUrl();
  const hints: string[] = [];
  const network = await runCartwaveNetworkDiagnostics();
  hints.push(...network.hints);

  const outboundIp = network.cartwaveFetchPublicIp;

  const envReport = {
    apiBaseUrl: baseUrl,
    outboundIpv4: cartwaveOutboundIpv4(),
    clientId: maskSecret(isCartwaveConfigured() ? cartwaveClientId() : process.env.CARTWAVE_CLIENT_ID ?? ""),
    clientSecret: maskSecret(isCartwaveConfigured() ? cartwaveClientSecret() : process.env.CARTWAVE_CLIENT_SECRET ?? ""),
    hmacKey: maskSecret(isCartwaveConfigured() ? cartwaveHmacKey() : process.env.CARTWAVE_HMAC_KEY ?? "", 6),
    sourceBranch: isCartwaveConfigured() ? cartwaveSourceAccountBranch() : process.env.CARTWAVE_SOURCE_ACCOUNT_BRANCH ?? "",
    sourceAccount: isCartwaveConfigured() ? cartwaveSourceAccountNumber() : process.env.CARTWAVE_SOURCE_ACCOUNT_NUMBER ?? "",
    cashoutPath: process.env.CARTWAVE_CASHOUT_PIX_SELF_APPROVE_PATH?.trim() || "/v2/finance/create-cashout-self-approve",
  };

  if (!isCartwaveConfigured()) {
    hints.push("Complete CARTWAVE_CLIENT_ID, CLIENT_SECRET, HMAC_KEY, SOURCE_ACCOUNT_BRANCH e SOURCE_ACCOUNT_NUMBER no .env.");
    return {
      configured: false,
      outboundIp,
      network,
      env: envReport,
      auth: {
        url: `${baseUrl.replace(/\/$/, "")}/v2/finance/auth-token/`,
        ok: false,
        httpStatus: null,
        elapsedMs: null,
        cloudfrontBlocked: false,
        cloudFrontPop: null,
        tokenPreview: null,
        error: "Cartwave nao configurado",
        responseHeaders: {},
        bodyPreview: null,
      },
      hints,
    };
  }

  const url = `${baseUrl.replace(/\/$/, "")}/v2/finance/auth-token/`;
  const started = Date.now();
  let res: Response;
  try {
    res = await cartwaveFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "bol-o-app/cartwave-debug",
      },
      body: JSON.stringify({
        client_id: cartwaveClientId(),
        client_secret: cartwaveClientSecret(),
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro de rede";
    if (msg.includes("CARTWAVE_OUTBOUND_IPV4") || msg.includes("EADDRNOTAVAIL")) {
      hints.push("Corrija CARTWAVE_OUTBOUND_IPV4 no servidor de producao e reinicie PM2/Docker antes de testar auth.");
    } else {
      hints.push("Falha de rede ao conectar na Cartwave — verifique DNS/firewall do servidor.");
    }
    return {
      configured: true,
      outboundIp,
      network,
      env: envReport,
      auth: {
        url,
        ok: false,
        httpStatus: null,
        elapsedMs: Date.now() - started,
        cloudfrontBlocked: false,
        cloudFrontPop: null,
        tokenPreview: null,
        error: msg,
        responseHeaders: {},
        bodyPreview: null,
      },
      hints,
    };
  }

  const elapsedMs = Date.now() - started;
  const failure = await readCartwaveHttpFailure(res);

  if (failure.cloudfrontBlocked) {
    hints.push(
      "HTTP 403 com HTML do CloudFront = WAF bloqueou antes da API. Peca a Cartwave para liberar o IP publico IPv4 deste servidor.",
    );
    if (network.nativeFetchPublicIp?.includes(":")) {
      hints.push(
        `Cartwave provavelmente viu IPv6 (${network.nativeFetchPublicIp}). Confirme CARTWAVE_OUTBOUND_IPV4=${envReport.outboundIpv4 ?? "?"} no servidor e reinicie o app.`,
      );
    }
    hints.push("Auth local (seu PC) tambem pode ser bloqueado — teste pelo servidor de producao.");
    hints.push("Credenciais podem estar corretas; o bloqueio impede validar.");
  } else if (failure.status === 400) {
    hints.push("HTTP 400 = client_id ou client_secret invalidos. Confira credenciais no painel Cartwave.");
  } else if (failure.status === 401) {
    hints.push("HTTP 401 = conta desabilitada na Cartwave. Contate o suporte.");
  } else if (!res.ok) {
    hints.push(`HTTP ${failure.status} na auth — veja bodyPreview na resposta.`);
  }

  const token =
    failure.parsed && typeof failure.parsed.access_token === "string" ? failure.parsed.access_token : null;

  return {
    configured: true,
    outboundIp,
    network,
    env: envReport,
    auth: {
      url,
      ok: res.ok && Boolean(token),
      httpStatus: failure.status,
      elapsedMs,
      cloudfrontBlocked: failure.cloudfrontBlocked,
      cloudFrontPop: failure.cloudFrontPop,
      tokenPreview: token ? maskSecret(token, 8) : null,
      error: res.ok && token ? null : buildCartwaveFailureMessage(failure, "Auth Cartwave"),
      responseHeaders: failure.headers,
      bodyPreview: failure.isJson ? JSON.stringify(failure.parsed) : failure.bodyPreview,
    },
    hints: [...new Set(hints)],
  };
}
