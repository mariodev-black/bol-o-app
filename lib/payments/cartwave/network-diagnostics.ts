import os from "node:os";
import { cartwaveOutboundIpv4, isCartwaveConfigured } from "@/lib/payments/cartwave/config";
import { cartwaveFetch } from "@/lib/payments/cartwave/http";

export type LocalIpv4Interface = {
  name: string;
  address: string;
  internal: boolean;
};

export type CartwaveNetworkDiagnostics = {
  configuredBindIpv4: string | null;
  bindIpv4AssignedLocally: boolean;
  localIpv4Interfaces: LocalIpv4Interface[];
  /** IP visto pelo ipify via `fetch` nativo (pode ser IPv6 — o que a Cartwave reporta sem bind). */
  nativeFetchPublicIp: string | null;
  nativeFetchError: string | null;
  /** IP visto pelo ipify via `cartwaveFetch` (deve ser o IPv4 whitelisted). */
  cartwaveFetchPublicIp: string | null;
  cartwaveFetchError: string | null;
  /** true se nativeFetch saiu por IPv6 e cartwaveFetch por IPv4. */
  ipv6LeakDetected: boolean;
  hints: string[];
};

export function listLocalIpv4Interfaces(): LocalIpv4Interface[] {
  const out: LocalIpv4Interface[] = [];
  const ifaces = os.networkInterfaces();
  for (const [name, entries] of Object.entries(ifaces)) {
    for (const entry of entries ?? []) {
      const family = String(entry.family);
      if (family !== "IPv4" && family !== "4") continue;
      out.push({
        name,
        address: entry.address,
        internal: Boolean(entry.internal),
      });
    }
  }
  return out;
}

export function isIpv4AssignedLocally(ip: string): boolean {
  const target = ip.trim();
  if (!target) return false;
  return listLocalIpv4Interfaces().some((iface) => iface.address === target);
}

async function probePublicIp(
  url: string,
  fetchFn: (url: string) => Promise<Response>,
): Promise<{ ip: string | null; error: string | null }> {
  try {
    const res = await fetchFn(url);
    if (!res.ok) {
      return { ip: null, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { ip?: string };
    return { ip: data.ip?.trim() || null, error: null };
  } catch (err) {
    return {
      ip: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runCartwaveNetworkDiagnostics(): Promise<CartwaveNetworkDiagnostics> {
  const configuredBindIpv4 = cartwaveOutboundIpv4();
  const localIpv4Interfaces = listLocalIpv4Interfaces();
  const bindIpv4AssignedLocally = configuredBindIpv4
    ? isIpv4AssignedLocally(configuredBindIpv4)
    : false;
  const hints: string[] = [];

  if (isCartwaveConfigured() && !configuredBindIpv4) {
    hints.push(
      "CARTWAVE_OUTBOUND_IPV4 nao definido — requisicoes podem sair por IPv6 (ex.: 2605:...) e ser bloqueadas pelo WAF.",
    );
  }

  if (configuredBindIpv4 && !bindIpv4AssignedLocally) {
    hints.push(
      `CARTWAVE_OUTBOUND_IPV4=${configuredBindIpv4} nao esta atribuido a nenhuma interface local (bind EADDRNOTAVAIL).`,
    );
    hints.push(
      "Confirme o IPv4 fixo no painel da VPS/hosting e reinicie o app no servidor de producao (nao no Mac local).",
    );
  }

  const [nativeProbe, cartwaveProbe] = await Promise.all([
    probePublicIp("https://api64.ipify.org?format=json", (url) =>
      fetch(url, { signal: AbortSignal.timeout(8000) }),
    ),
    probePublicIp("https://api4.ipify.org?format=json", (url) =>
      cartwaveFetch(url, { signal: AbortSignal.timeout(8000) }),
    ),
  ]);

  const ipv6LeakDetected =
    Boolean(nativeProbe.ip?.includes(":")) &&
    Boolean(cartwaveProbe.ip && !cartwaveProbe.ip.includes(":"));

  if (nativeProbe.ip?.includes(":")) {
    hints.push(
      `fetch nativo sai por IPv6 (${nativeProbe.ip}) — e isso que a Cartwave ve se CARTWAVE_OUTBOUND_IPV4 nao estiver ativo.`,
    );
  }

  if (cartwaveProbe.error) {
    hints.push(`cartwaveFetch falhou: ${cartwaveProbe.error}`);
  } else if (cartwaveProbe.ip) {
    hints.push(`cartwaveFetch IP publico: ${cartwaveProbe.ip}`);
    if (configuredBindIpv4 && cartwaveProbe.ip !== configuredBindIpv4) {
      hints.push(
        `ATENCAO: IP de saida (${cartwaveProbe.ip}) difere de CARTWAVE_OUTBOUND_IPV4 (${configuredBindIpv4}). Confirme whitelist na Cartwave.`,
      );
    }
  }

  if (ipv6LeakDetected && cartwaveProbe.ip) {
    hints.push(
      "Bind IPv4 OK: cartwaveFetch usa IPv4; fetch nativo usaria IPv6. O app em producao deve usar apenas cartwaveFetch.",
    );
  }

  return {
    configuredBindIpv4,
    bindIpv4AssignedLocally,
    localIpv4Interfaces,
    nativeFetchPublicIp: nativeProbe.ip,
    nativeFetchError: nativeProbe.error,
    cartwaveFetchPublicIp: cartwaveProbe.ip,
    cartwaveFetchError: cartwaveProbe.error,
    ipv6LeakDetected,
    hints,
  };
}
