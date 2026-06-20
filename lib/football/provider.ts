/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Arquitetura v2 — Provider unico da API Futebol.
 *
 * Duas estrategias:
 *   - PRINCIPAL (`FOOTBALL_COMPETITION_ID`):
 *       GET /campeonatos/:id/partidas  — payload HIERARQUICO (fases > chaves > ida/volta > partidas).
 *       Percorre tudo recursivamente para extrair todas as partidas.
 *
 *   - EXTRA (`BOLOES_EXTRA_CHAMPIONSHIP_IDS`):
 *       1) GET /campeonatos/:id              -> rodada_atual (numero), fase_atual, status, temporada
 *       2) GET /campeonatos/:id/rodadas/:n   -> partidas da rodada (chave do bolao extra)
 *
 * Tambem expoe:
 *   - fetchMatchDetailById(matchId)         -> /partidas/:id  (worker realtime)
 */

import { fetchFootballApiV1 } from "@/lib/football-api-fetch";
import {
  fetchChampionshipFaseDetail,
  pickRodadaAtualFromFasePayload,
} from "@/lib/football/fase-rodada-atual";
import {
  parseKickoffFromPartidaPayload,
  pickScoreFromPartidaPayload,
} from "@/lib/partida-placar";

const BASE = "https://api.api-futebol.com.br/v1";

function tokenOrThrow(): string {
  const t = (process.env.FOOTBALL_API_TOKEN || "").trim();
  if (!t) throw new Error("FOOTBALL_API_TOKEN nao configurado");
  return t;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${tokenOrThrow()}` };
}

// ---------------------------------------------------------------------
// Tipos canonicos da v2
// ---------------------------------------------------------------------

export type ProviderMatchV2 = {
  /** /partidas/:id */
  matchId: number;
  slug: string | null;
  status: string;
  kickoffAt: string | null; // ISO normalizado
  dataRealizacao: string;   // DD/MM/YYYY
  horaRealizacao: string;   // HH:MM
  dataRealizacaoIso: string | null;

  // placar oficial
  resultCasa: number | null;
  resultVisitante: number | null;
  disputaPenalti: boolean | null;
  penaltisCasa: number | null;
  penaltisVisitante: number | null;

  // estrutura (fase/rodada)
  phaseKey: string | null;     // back-compat com matches_cache.phase_key
  fasesNome: string | null;
  fasesSlug: string | null;
  rodada: number | null;
  rodadaSlug: string | null;
  groupKey: string | null;
  roundKey: string | null;     // back-compat (slug)

  // times
  homeTeamId: number | null;
  homeName: string;
  homePopular: string | null;
  homeSigla: string;
  homeLogo: string | null;
  awayTeamId: number | null;
  awayName: string;
  awayPopular: string | null;
  awaySigla: string;
  awayLogo: string | null;

  // estadio
  estadioId: number | null;
  estadioNome: string | null;

  // campeonato
  competitionId: number;
  championshipNome: string | null;
  championshipSlug: string | null;
  championshipTemporada: string | null;

  /** Payload original (auditoria/debug). */
  rawProviderPayload: unknown;
};

export type ChampionshipSnapshotV2 = {
  competitionId: number;
  nome: string;
  nomePopular: string | null;
  slug: string;
  temporada: string | null;
  status: string | null;
  logo: string | null;
  totalRodadas: number | null;
  rodadaAtual: {
    numero: number | null;
    slug: string | null;
    nome: string | null;
    status: string | null;
  } | null;
  faseAtual: {
    faseId: number | null;
    nome: string | null;
    slug: string | null;
  } | null;
  raw: unknown;
};

// ---------------------------------------------------------------------
// Helpers de extracao
// ---------------------------------------------------------------------

function isPartida(value: any): boolean {
  // Aceita partidas com times null/undefined (fases eliminatórias com vaga A definir)
  return Boolean(
    value &&
      typeof value === "object" &&
      Number.isFinite(Number(value.partida_id)),
  );
}

function asInt(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "sim", "yes"].includes(s)) return true;
  if (["0", "false", "nao", "não", "no"].includes(s)) return false;
  return null;
}

function pickEstadio(p: any): { id: number | null; nome: string | null } {
  const e = p?.estadio ?? p?.stadium ?? null;
  if (!e || typeof e !== "object") return { id: null, nome: null };
  const id = asInt((e as any).estadio_id ?? (e as any).id);
  const nome = asStr((e as any).nome_popular ?? (e as any).nome);
  return { id, nome };
}

function pickPenaltis(p: any): {
  disputa: boolean | null;
  casa: number | null;
  visit: number | null;
} {
  const pen = p?.penaltis ?? null;
  if (pen && typeof pen === "object") {
    return {
      disputa: true,
      casa: asInt((pen as any).mandante ?? (pen as any).casa),
      visit: asInt((pen as any).visitante ?? (pen as any).visita),
    };
  }
  const flag = asBool(p?.disputa_penalti ?? p?.tem_disputa_de_penaltis);
  return {
    disputa: flag,
    casa: asInt(p?.placar_penaltis_mandante ?? p?.penaltis_mandante),
    visit: asInt(p?.placar_penaltis_visitante ?? p?.penaltis_visitante),
  };
}

function mapPartida(
  p: any,
  ctx: {
    competitionId: number;
    phaseKey?: string | null;
    fasesNome?: string | null;
    fasesSlug?: string | null;
    rodada?: number | null;
    rodadaSlug?: string | null;
    groupKey?: string | null;
    roundKey?: string | null;
    championshipNome?: string | null;
    championshipSlug?: string | null;
    championshipTemporada?: string | null;
  },
): ProviderMatchV2 | null {
  const id = asInt(p?.partida_id);
  if (id == null) return null;

  const homeId = asInt(p?.time_mandante?.time_id ?? p?.time_mandante?.id);
  const awayId = asInt(p?.time_visitante?.time_id ?? p?.time_visitante?.id);

  const home = p?.time_mandante ?? {};
  const away = p?.time_visitante ?? {};

  const homePopular = asStr(home.nome_popular);
  const homeNome = asStr(home.nome) ?? homePopular ?? asStr(home.sigla) ?? "A definir";
  const homeSigla = asStr(home.sigla) ?? homePopular ?? (homeNome !== "A definir" ? homeNome : null) ?? "---";

  const awayPopular = asStr(away.nome_popular);
  const awayNome = asStr(away.nome) ?? awayPopular ?? asStr(away.sigla) ?? "A definir";
  const awaySigla = asStr(away.sigla) ?? awayPopular ?? (awayNome !== "A definir" ? awayNome : null) ?? "---";

  const { id: estadioId, nome: estadioNome } = pickEstadio(p);
  const { disputa, casa, visit } = pickPenaltis(p);

  return {
    matchId: id,
    slug: asStr(p?.slug),
    status: asStr(p?.status) ?? "agendado",
    kickoffAt: parseKickoffFromPartidaPayload(p),
    dataRealizacao: asStr(p?.data_realizacao) ?? "",
    horaRealizacao: asStr(p?.hora_realizacao) ?? "",
    dataRealizacaoIso: asStr(p?.data_realizacao_iso),

    resultCasa: pickScoreFromPartidaPayload(p, "casa"),
    resultVisitante: pickScoreFromPartidaPayload(p, "visitante"),
    disputaPenalti: disputa,
    penaltisCasa: casa,
    penaltisVisitante: visit,

    phaseKey: ctx.phaseKey ?? null,
    fasesNome: ctx.fasesNome ?? null,
    fasesSlug: ctx.fasesSlug ?? null,
    rodada: ctx.rodada ?? null,
    rodadaSlug: ctx.rodadaSlug ?? null,
    groupKey: ctx.groupKey ?? null,
    roundKey: ctx.roundKey ?? null,

    homeTeamId: homeId,
    homeName: homeNome,
    homePopular,
    homeSigla,
    homeLogo: asStr(home.escudo),
    awayTeamId: awayId,
    awayName: awayNome,
    awayPopular,
    awaySigla,
    awayLogo: asStr(away.escudo),

    estadioId,
    estadioNome,

    competitionId: ctx.competitionId,
    championshipNome: ctx.championshipNome ?? null,
    championshipSlug: ctx.championshipSlug ?? null,
    championshipTemporada: ctx.championshipTemporada ?? null,

    rawProviderPayload: p,
  };
}

function walkPrincipalPartidas(
  node: any,
  ctx: {
    competitionId: number;
    championshipNome?: string | null;
    championshipSlug?: string | null;
    championshipTemporada?: string | null;
  },
  path: string[] = [],
  out: ProviderMatchV2[] = [],
): ProviderMatchV2[] {
  if (!node) return out;

  if (Array.isArray(node)) {
    for (const item of node) {
      if (isPartida(item)) {
        const phase = path[0] ?? "geral";
        const round = path[path.length - 1] ?? "rodada-unica";
        const mapped = mapPartida(item, {
          ...ctx,
          phaseKey: phase,
          fasesSlug: phase,
          fasesNome: phase,
          rodadaSlug: round,
          roundKey: round,
          groupKey: path.length >= 3 ? path[1] ?? null : null,
        });
        if (mapped) out.push(mapped);
      } else {
        walkPrincipalPartidas(item, ctx, path, out);
      }
    }
    return out;
  }

  if (typeof node === "object") {
    if (isPartida(node)) {
      const phase = path[0] ?? "geral";
      const round = path[path.length - 1] ?? "rodada-unica";
      const mapped = mapPartida(node, {
        ...ctx,
        phaseKey: phase,
        fasesSlug: phase,
        fasesNome: phase,
        rodadaSlug: round,
        roundKey: round,
        groupKey: path.length >= 3 ? path[1] ?? null : null,
      });
      if (mapped) out.push(mapped);
      return out;
    }
    for (const [key, value] of Object.entries(node)) {
      walkPrincipalPartidas(value, ctx, [...path, key], out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// API publica
// ---------------------------------------------------------------------

/**
 * Snapshot do campeonato: nome, slug, temporada, rodada_atual, fase_atual, status.
 * Usado pelos extras para descobrir a rodada que deve ser carregada.
 */
export async function fetchChampionshipSnapshot(
  competitionId: number,
): Promise<ChampionshipSnapshotV2> {
  const url = `${BASE}/campeonatos/${competitionId}`;
  const res = await fetchFootballApiV1(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`fetchChampionshipSnapshot(${competitionId}): HTTP ${res.status}`);
  }
  const raw = (await res.json()) as any;

  const rodadaAtualRaw = raw?.rodada_atual ?? null;
  const faseAtualRaw = raw?.fase_atual ?? null;
  const faseId =
    faseAtualRaw && typeof faseAtualRaw === "object"
      ? asInt((faseAtualRaw as any).fase_id)
      : null;

  let rodadaAtual: ChampionshipSnapshotV2["rodadaAtual"] =
    rodadaAtualRaw && typeof rodadaAtualRaw === "object"
      ? {
          numero: asInt((rodadaAtualRaw as any).rodada),
          slug: asStr((rodadaAtualRaw as any).slug),
          nome: asStr((rodadaAtualRaw as any).nome),
          status: asStr((rodadaAtualRaw as any).status),
        }
      : null;

  if (!rodadaAtual?.numero && faseId) {
    const faseDetail = await fetchChampionshipFaseDetail(competitionId, faseId);
    const fromFase = pickRodadaAtualFromFasePayload(faseDetail);
    if (fromFase?.numero) {
      rodadaAtual = {
        numero: fromFase.numero,
        slug: fromFase.slug,
        nome: fromFase.nome,
        status: fromFase.status,
      };
    }
  }

  return {
    competitionId,
    nome: asStr(raw?.nome) ?? asStr(raw?.nome_popular) ?? `Campeonato ${competitionId}`,
    nomePopular: asStr(raw?.nome_popular),
    slug: asStr(raw?.slug) ?? `comp-${competitionId}`,
    temporada: asStr(raw?.temporada),
    status: asStr(raw?.status),
    logo: asStr(raw?.logo),
    totalRodadas: asInt(raw?.total_rodadas),
    rodadaAtual,
    faseAtual: faseAtualRaw && typeof faseAtualRaw === "object"
      ? {
          faseId,
          nome: asStr((faseAtualRaw as any).nome),
          slug: asStr((faseAtualRaw as any).slug),
        }
      : null,
    raw,
  };
}

/**
 * Partidas do campeonato PRINCIPAL — endpoint hierarquico.
 *
 * Endpoint: /campeonatos/:id/partidas
 *
 * Resposta tem fases > chaves > ida/volta > partidas. Percorremos todo o payload
 * para juntar todas as partidas em uma lista plana.
 */
export async function fetchPrincipalMatches(
  competitionId: number,
  championshipMeta?: Pick<
    ChampionshipSnapshotV2,
    "nome" | "slug" | "temporada"
  >,
): Promise<ProviderMatchV2[]> {
  const url = `${BASE}/campeonatos/${competitionId}/partidas`;
  const res = await fetchFootballApiV1(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`fetchPrincipalMatches(${competitionId}): HTTP ${res.status}`);
  }
  const data = (await res.json()) as any;

  const meta =
    championshipMeta ??
    (await fetchChampionshipSnapshot(competitionId).catch(() => null)) ??
    null;

  const ctx = {
    competitionId,
    championshipNome: meta?.nome ?? null,
    championshipSlug: meta?.slug ?? null,
    championshipTemporada: meta?.temporada ?? null,
  };

  // O payload "oficial" expoe `fases` ou `partidas` dependendo do plano; varremos o objeto.
  const root = data?.fases ?? data?.partidas ?? data;
  return walkPrincipalPartidas(root, ctx);
}

/**
 * Partidas de uma rodada especifica de qualquer campeonato (estrategia extra).
 *
 * Endpoint: /campeonatos/:id/rodadas/:rodada
 */
export async function fetchRodadaMatches(
  competitionId: number,
  rodada: number,
  championshipMeta?: Pick<
    ChampionshipSnapshotV2,
    "nome" | "slug" | "temporada"
  >,
): Promise<ProviderMatchV2[]> {
  const url = `${BASE}/campeonatos/${competitionId}/rodadas/${rodada}`;
  const res = await fetchFootballApiV1(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(
      `fetchRodadaMatches(${competitionId}, ${rodada}): HTTP ${res.status}`,
    );
  }
  const data = (await res.json()) as any;

  const meta =
    championshipMeta ??
    (await fetchChampionshipSnapshot(competitionId).catch(() => null)) ??
    null;

  const rodadaSlug = asStr(data?.slug) ?? `rodada-${rodada}`;
  const out: ProviderMatchV2[] = [];
  const baseCtx = {
    competitionId,
    championshipNome: meta?.nome ?? null,
    championshipSlug: meta?.slug ?? null,
    championshipTemporada: meta?.temporada ?? null,
    rodada,
    rodadaSlug,
    roundKey: rodadaSlug,
  };

  const pushPartida = (p: unknown, groupKey: string | null) => {
    const mapped = mapPartida(p, {
      ...baseCtx,
      phaseKey: groupKey ?? "fase-unica",
      fasesNome: groupKey ?? "Fase única",
      fasesSlug: groupKey ?? "fase-unica",
      groupKey,
    });
    if (mapped) out.push(mapped);
  };

  if (Array.isArray(data?.partidas)) {
    for (const p of data.partidas) pushPartida(p, null);
    return out;
  }

  for (const [key, value] of Object.entries(data ?? {})) {
    if (key === "partidas" && Array.isArray(value)) {
      for (const p of value) pushPartida(p, null);
      continue;
    }
    if (!key.startsWith("grupo")) continue;
    const list = Array.isArray(value)
      ? value
      : value && typeof value === "object" && Array.isArray((value as any).partidas)
        ? (value as any).partidas
        : null;
    if (!list) continue;
    for (const p of list) pushPartida(p, key);
  }

  if (out.length === 0) {
    walkPrincipalPartidas(data, baseCtx, [], out);
  }

  return out;
}

/**
 * Detalhe de UMA partida especifica (usado pelo worker realtime).
 *
 * Endpoint: /partidas/:id
 */
export async function fetchMatchDetailById(
  matchId: number,
): Promise<ProviderMatchV2 | null> {
  const url = `${BASE}/partidas/${matchId}`;
  const res = await fetchFootballApiV1(url, { headers: authHeaders() });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  if (!data || !Number.isFinite(Number(data.partida_id))) return null;

  // Tenta extrair competitionId; se nao vier, retorna sem (caller preserva o anterior do cache).
  const compId =
    asInt(data?.campeonato?.campeonato_id) ??
    asInt(data?.campeonato_id) ??
    asInt(data?.campeonato?.id) ??
    0;

  return mapPartida(data, {
    competitionId: compId,
    championshipNome: asStr(data?.campeonato?.nome),
    championshipSlug: asStr(data?.campeonato?.slug),
    championshipTemporada: asStr(data?.campeonato?.temporada),
  });
}
