/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Campeonatos mistos (ex.: Libertadores id 7) podem vir com `rodada_atual: null`
 * no snapshot do campeonato, mas com `rodada_atual` em cada grupo da fase atual.
 */

import { fetchFootballApiV1 } from "@/lib/football-api-fetch";

const BASE = "https://api.api-futebol.com.br/v1";

function tokenOrThrow(): string {
  const t = (process.env.FOOTBALL_API_TOKEN || "").trim();
  if (!t) throw new Error("FOOTBALL_API_TOKEN nao configurado");
  return t;
}

function asInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export type FaseRodadaPick = {
  numero: number;
  slug: string | null;
  nome: string | null;
  status: string | null;
};

function rodadaEncerrada(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s.includes("encerr") || s.includes("finaliz") || s === "final" || s === "fechad";
}

/**
 * Escolhe a rodada “ativa” entre os grupos da fase (maior número; em empate,
 * prefere status aberto/agendado em vez de encerrado).
 */
export function pickRodadaAtualFromFasePayload(faseRaw: unknown): FaseRodadaPick | null {
  if (!faseRaw || typeof faseRaw !== "object") return null;
  const grupos = (faseRaw as any).grupos;
  if (!grupos || typeof grupos !== "object") return null;

  let best: FaseRodadaPick | null = null;
  for (const group of Object.values(grupos)) {
    if (!group || typeof group !== "object") continue;
    const ra = (group as any).rodada_atual;
    if (!ra || typeof ra !== "object") continue;
    const numero = asInt((ra as any).rodada);
    if (!numero) continue;
    const candidate: FaseRodadaPick = {
      numero,
      slug: asStr((ra as any).slug),
      nome: asStr((ra as any).nome),
      status: asStr((ra as any).status),
    };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.numero > best.numero) {
      best = candidate;
      continue;
    }
    if (candidate.numero === best.numero) {
      const bestClosed = rodadaEncerrada(best.status);
      const candClosed = rodadaEncerrada(candidate.status);
      if (bestClosed && !candClosed) best = candidate;
    }
  }
  return best;
}

export async function fetchChampionshipFaseDetail(
  competitionId: number,
  faseId: number,
): Promise<unknown | null> {
  const url = `${BASE}/campeonatos/${competitionId}/fases/${faseId}`;
  const res = await fetchFootballApiV1(url, {
    headers: { Authorization: `Bearer ${tokenOrThrow()}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}
