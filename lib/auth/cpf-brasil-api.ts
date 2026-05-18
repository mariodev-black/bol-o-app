import "server-only";
import { isValidCpf, normalizeCpf } from "@/lib/auth/cpf";

const API_BASE = "https://api.cpf-brasil.org/cpf";

export type CpfBrasilPerson = {
  cpf: string;
  nome: string;
  sexo: string;
  nasc: string;
};

export type CpfBrasilFetchResult =
  | { ok: true; data: CpfBrasilPerson }
  | {
      ok: false;
      reason: "missing_key" | "invalid_cpf" | "not_found" | "unavailable" | "unauthorized";
    };

/** Mascara nome para exibição (ex.: CE*** VI**** CO******). */
export function maskPersonName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2) return `${(part[0] ?? "*").toUpperCase()}*`;
      const visible = part.slice(0, 2).toUpperCase();
      return `${visible}${"*".repeat(Math.max(1, part.length - 2))}`;
    })
    .join(" ");
}

export function mapCpfSexoToGender(
  sexo: string,
): "masculino" | "feminino" | "nao_informar" {
  const s = sexo.trim().toUpperCase();
  if (s === "M" || s === "MASCULINO") return "masculino";
  if (s === "F" || s === "FEMININO") return "feminino";
  return "nao_informar";
}

export async function fetchCpfFromBrasilApi(
  rawCpf: string,
): Promise<CpfBrasilFetchResult> {
  const cpf = normalizeCpf(rawCpf);
  if (!isValidCpf(cpf)) {
    return { ok: false, reason: "invalid_cpf" };
  }

  const apiKey = process.env.CPF_BRASIL_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "missing_key" };
  }

  try {
    const res = await fetch(`${API_BASE}/${cpf}`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "unauthorized" };
    }

    if (res.status === 404) {
      return { ok: false, reason: "not_found" };
    }

    if (!res.ok) {
      return { ok: false, reason: "unavailable" };
    }

    const json = (await res.json()) as {
      success?: boolean;
      data?: {
        CPF?: string;
        NOME?: string;
        SEXO?: string;
        NASC?: string;
      };
    };

    if (!json.success || !json.data?.NOME?.trim()) {
      return { ok: false, reason: "not_found" };
    }

    return {
      ok: true,
      data: {
        cpf: normalizeCpf(json.data.CPF ?? cpf),
        nome: json.data.NOME.trim(),
        sexo: (json.data.SEXO ?? "").trim(),
        nasc: (json.data.NASC ?? "").trim(),
      },
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
