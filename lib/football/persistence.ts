/**
 * Arquitetura v2 — Persistencia das partidas/campeonatos no Postgres.
 *
 * Esta camada escreve em:
 *   - matches_cache         (colunas novas: slug, time_ids, escudos, estadio,
 *                            penaltis, fase/rodada, championship_*)
 *   - championships_cache   (nome, slug, rodada_atual, fase_atual, status)
 *
 * Mantem compat. com o codigo legado: `phase_key`, `group_key`, `round_key`,
 * `home_name/sigla/logo`, `away_name/sigla/logo`, `date_br`, `hour_br` continuam
 * sendo escritos com os mesmos formatos.
 */

import { getPool } from "@/lib/db";
import { invalidateMatchMapMemoryAfterDbWrite } from "@/lib/match-map-cache-invalidator";
import { processPrizeClosuresAfterMatchSync } from "@/lib/prizes/processor";
import { recomputePredictionScoresForMatches } from "@/lib/predictions/score-recompute";
import type {
  ChampionshipSnapshotV2,
  ProviderMatchV2,
} from "@/lib/football/provider";

const MATCH_UPSERT_CHUNK = 60;

/**
 * Upsert idempotente em `matches_cache`. Atualiza apenas o que muda; preserva
 * placar/kickoff/datas existentes via COALESCE (a API as vezes devolve nulo).
 */
const MATCH_UPSERT_SQL = `INSERT INTO matches_cache (
  competition_id, match_id,
  phase_key, group_key, round_key,
  status, kickoff_at,
  date_br, hour_br,
  result_casa, result_visitante,
  home_name, home_sigla, home_logo,
  away_name, away_sigla, away_logo,
  slug, disputa_penalti, penaltis_casa, penaltis_visitante,
  data_realizacao_iso, rodada, rodada_slug, fase_nome, fase_slug,
  championship_name, championship_slug, championship_temporada,
  home_team_id, away_team_id, estadio_id, estadio_nome, provider_payload,
  source_updated_at, synced_at
) VALUES %VALUES%
ON CONFLICT (competition_id, match_id)
DO UPDATE SET
  phase_key                = COALESCE(EXCLUDED.phase_key, matches_cache.phase_key),
  group_key                = COALESCE(EXCLUDED.group_key, matches_cache.group_key),
  round_key                = COALESCE(EXCLUDED.round_key, matches_cache.round_key),
  status                   = EXCLUDED.status,
  kickoff_at               = COALESCE(EXCLUDED.kickoff_at, matches_cache.kickoff_at),
  date_br                  = COALESCE(NULLIF(EXCLUDED.date_br, ''), matches_cache.date_br),
  hour_br                  = COALESCE(NULLIF(EXCLUDED.hour_br, ''), matches_cache.hour_br),
  result_casa              = COALESCE(EXCLUDED.result_casa, matches_cache.result_casa),
  result_visitante         = COALESCE(EXCLUDED.result_visitante, matches_cache.result_visitante),
  home_name                = COALESCE(EXCLUDED.home_name, matches_cache.home_name),
  home_sigla               = COALESCE(EXCLUDED.home_sigla, matches_cache.home_sigla),
  home_logo                = COALESCE(EXCLUDED.home_logo, matches_cache.home_logo),
  away_name                = COALESCE(EXCLUDED.away_name, matches_cache.away_name),
  away_sigla               = COALESCE(EXCLUDED.away_sigla, matches_cache.away_sigla),
  away_logo                = COALESCE(EXCLUDED.away_logo, matches_cache.away_logo),
  slug                     = COALESCE(EXCLUDED.slug, matches_cache.slug),
  disputa_penalti          = COALESCE(EXCLUDED.disputa_penalti, matches_cache.disputa_penalti),
  penaltis_casa            = COALESCE(EXCLUDED.penaltis_casa, matches_cache.penaltis_casa),
  penaltis_visitante       = COALESCE(EXCLUDED.penaltis_visitante, matches_cache.penaltis_visitante),
  data_realizacao_iso      = COALESCE(EXCLUDED.data_realizacao_iso, matches_cache.data_realizacao_iso),
  rodada                   = COALESCE(EXCLUDED.rodada, matches_cache.rodada),
  rodada_slug              = COALESCE(EXCLUDED.rodada_slug, matches_cache.rodada_slug),
  fase_nome                = COALESCE(EXCLUDED.fase_nome, matches_cache.fase_nome),
  fase_slug                = COALESCE(EXCLUDED.fase_slug, matches_cache.fase_slug),
  championship_name        = COALESCE(EXCLUDED.championship_name, matches_cache.championship_name),
  championship_slug        = COALESCE(EXCLUDED.championship_slug, matches_cache.championship_slug),
  championship_temporada   = COALESCE(EXCLUDED.championship_temporada, matches_cache.championship_temporada),
  home_team_id             = COALESCE(EXCLUDED.home_team_id, matches_cache.home_team_id),
  away_team_id             = COALESCE(EXCLUDED.away_team_id, matches_cache.away_team_id),
  estadio_id               = COALESCE(EXCLUDED.estadio_id, matches_cache.estadio_id),
  estadio_nome             = COALESCE(EXCLUDED.estadio_nome, matches_cache.estadio_nome),
  provider_payload         = COALESCE(EXCLUDED.provider_payload, matches_cache.provider_payload),
  source_updated_at        = now(),
  synced_at                = now()`;

function brDateHourFromKickoff(kickoffAt: string | null): {
  date: string;
  hour: string;
} {
  const iso = kickoffAt?.trim();
  if (!iso) return { date: "", hour: "" };
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { date: "", hour: "" };
  return {
    date: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parsed),
    hour: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(parsed),
  };
}

function effectiveMatchDateFields(m: ProviderMatchV2): {
  date: string;
  hour: string;
} {
  let date = String(m.dataRealizacao ?? "").trim();
  let hour = String(m.horaRealizacao ?? "").trim();
  if ((!date || date === "undefined" || date === "null") && m.kickoffAt) {
    const fromKick = brDateHourFromKickoff(m.kickoffAt);
    date = fromKick.date;
    hour = fromKick.hour || hour;
  }
  return { date, hour };
}

function buildRow(m: ProviderMatchV2): unknown[] {
  const { date, hour } = effectiveMatchDateFields(m);
  return [
    m.competitionId,
    m.matchId,
    m.phaseKey,
    m.groupKey,
    m.roundKey,
    m.status,
    m.kickoffAt,
    date,
    hour,
    m.resultCasa,
    m.resultVisitante,
    m.homeName,
    m.homeSigla,
    m.homeLogo,
    m.awayName,
    m.awaySigla,
    m.awayLogo,
    m.slug,
    m.disputaPenalti,
    m.penaltisCasa,
    m.penaltisVisitante,
    m.dataRealizacaoIso,
    m.rodada,
    m.rodadaSlug,
    m.fasesNome,
    m.fasesSlug,
    m.championshipNome,
    m.championshipSlug,
    m.championshipTemporada,
    m.homeTeamId,
    m.awayTeamId,
    m.estadioId,
    m.estadioNome,
    m.rawProviderPayload == null ? null : JSON.stringify(m.rawProviderPayload),
  ];
}

const COLS_PER_ROW = 34;

function matchDedupeKey(m: ProviderMatchV2): string {
  return `${Number(m.competitionId)}:${Number(m.matchId)}`;
}

/**
 * Deduplica partidas por (competitionId, matchId) — a API Futebol pode listar
 * a mesma partida em multiplos nos da arvore hierarquica (ex.: ida/volta de
 * chave). Mergeia campos: a ultima ocorrencia "ganha" para escalares; campos
 * nao-nulos sao preferidos sobre nulos.
 */
function dedupeMatches(matches: ProviderMatchV2[]): ProviderMatchV2[] {
  const byKey = new Map<string, ProviderMatchV2>();
  for (const m of matches) {
    const key = matchDedupeKey(m);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, m);
      continue;
    }
    // merge: prefere valores nao-nulos. Para placar / status, a ULTIMA
    // ocorrencia ganha (assumimos ordem mais "fresca" no payload).
    const merged: ProviderMatchV2 = {
      ...prev,
      ...m,
      kickoffAt: m.kickoffAt ?? prev.kickoffAt,
      slug: m.slug ?? prev.slug,
      resultCasa: m.resultCasa ?? prev.resultCasa,
      resultVisitante: m.resultVisitante ?? prev.resultVisitante,
      disputaPenalti: m.disputaPenalti ?? prev.disputaPenalti,
      penaltisCasa: m.penaltisCasa ?? prev.penaltisCasa,
      penaltisVisitante: m.penaltisVisitante ?? prev.penaltisVisitante,
      phaseKey: m.phaseKey ?? prev.phaseKey,
      fasesNome: m.fasesNome ?? prev.fasesNome,
      fasesSlug: m.fasesSlug ?? prev.fasesSlug,
      rodada: m.rodada ?? prev.rodada,
      rodadaSlug: m.rodadaSlug ?? prev.rodadaSlug,
      groupKey: m.groupKey ?? prev.groupKey,
      roundKey: m.roundKey ?? prev.roundKey,
      homeTeamId: m.homeTeamId ?? prev.homeTeamId,
      awayTeamId: m.awayTeamId ?? prev.awayTeamId,
      homeLogo: m.homeLogo ?? prev.homeLogo,
      awayLogo: m.awayLogo ?? prev.awayLogo,
      estadioId: m.estadioId ?? prev.estadioId,
      estadioNome: m.estadioNome ?? prev.estadioNome,
      championshipNome: m.championshipNome ?? prev.championshipNome,
      championshipSlug: m.championshipSlug ?? prev.championshipSlug,
      championshipTemporada: m.championshipTemporada ?? prev.championshipTemporada,
      dataRealizacaoIso: m.dataRealizacaoIso ?? prev.dataRealizacaoIso,
    };
    byKey.set(key, merged);
  }
  return Array.from(byKey.values());
}

type PrevSnapshot = {
  status: string | null;
  result_casa: number | null;
  result_visitante: number | null;
  disputa_penalti: boolean | null;
  penaltis_casa: number | null;
  penaltis_visitante: number | null;
  kickoff_at: string | null;
};

function normStatus(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

/**
 * Compara campos "que importam para a pontuação / ranking". Mudou aqui ⇒
 * recompute de `prediction_scores`, cascata de prêmios e revalidate do Next.
 *
 * `null` vindo da API significa "sem informação" — NÃO conta como diff
 * (já temos COALESCE no UPSERT).
 */
function placarFieldsChanged(prev: PrevSnapshot, next: ProviderMatchV2): boolean {
  if (next.resultCasa != null && next.resultCasa !== prev.result_casa) return true;
  if (next.resultVisitante != null && next.resultVisitante !== prev.result_visitante) return true;
  return false;
}

function scoredFieldsChanged(prev: PrevSnapshot, next: ProviderMatchV2): boolean {
  if (next.status != null && normStatus(prev.status) !== normStatus(next.status)) return true;
  if (next.resultCasa != null && next.resultCasa !== prev.result_casa) return true;
  if (next.resultVisitante != null && next.resultVisitante !== prev.result_visitante) return true;
  if (next.disputaPenalti != null && next.disputaPenalti !== prev.disputa_penalti) return true;
  if (next.penaltisCasa != null && next.penaltisCasa !== prev.penaltis_casa) return true;
  if (next.penaltisVisitante != null && next.penaltisVisitante !== prev.penaltis_visitante) return true;
  return false;
}

/**
 * Persiste um lote de partidas com **diff antes do UPSERT**:
 *   1) SELECT em batch para descobrir o estado atual no DB.
 *   2) Particiona em "novo / mudou / igual" — só faz UPSERT do que mudou.
 *   3) Recomputa `prediction_scores` apenas para partidas cuja PONTUAÇÃO mudou
 *      (status novo / placar / pênaltis) — `scoredChangedIds`.
 *   4) Cascata (revalidate, prêmios) só se `scoredChangedIds.length > 0`.
 *
 * Resultado: em ticks "tudo igual" o DB e o Next sequer são tocados pela API
 * (zero WAL, zero invalidação de cache de rota).
 */
export async function persistMatchesV2(
  matches: ProviderMatchV2[],
  opts?: { runCascadingClosures?: boolean; cascadeSource?: string },
): Promise<{
  written: number;
  changedMatchIds: number[];   // partidas que tiveram UPSERT (qualquer campo)
  scoredChangedIds: number[];  // partidas cuja pontuação mudou (subset)
  deduped: number;
  unchanged: number;
  predictionScoresUpdated: number;
}> {
  if (matches.length === 0) {
    return {
      written: 0,
      changedMatchIds: [],
      scoredChangedIds: [],
      deduped: 0,
      unchanged: 0,
      predictionScoresUpdated: 0,
    };
  }

  const unique = dedupeMatches(matches);
  const deduped = matches.length - unique.length;

  const pool = getPool();
  const client = await pool.connect();

  const writtenMatchIds: number[] = [];
  const scoredChangedIds: number[] = [];
  const placarChangedIds: number[] = [];
  let unchanged = 0;
  let predictionScoresUpdated = 0;

  try {
    await client.query("BEGIN");

    // ---- 1) SELECT estado atual em batch (1 query) ----
    const keys = unique.map((m) => ({ c: m.competitionId, i: m.matchId }));
    const compIds = keys.map((k) => k.c);
    const matchIds = keys.map((k) => k.i);
    const prevRows = await client.query<{
      competition_id: number;
      match_id: number;
      status: string | null;
      result_casa: number | null;
      result_visitante: number | null;
      disputa_penalti: boolean | null;
      penaltis_casa: number | null;
      penaltis_visitante: number | null;
      kickoff_at: string | null;
    }>(
      `SELECT competition_id, match_id, status, result_casa, result_visitante,
              disputa_penalti, penaltis_casa, penaltis_visitante, kickoff_at::text AS kickoff_at
         FROM matches_cache
        WHERE (competition_id, match_id) IN (
          SELECT unnest($1::int[]), unnest($2::bigint[])
        )`,
      [compIds, matchIds],
    );
    const prevByKey = new Map<string, PrevSnapshot>();
    for (const r of prevRows.rows) {
      prevByKey.set(`${Number(r.competition_id)}:${Number(r.match_id)}`, {
        status: r.status,
        result_casa: r.result_casa,
        result_visitante: r.result_visitante,
        disputa_penalti: r.disputa_penalti,
        penaltis_casa: r.penaltis_casa,
        penaltis_visitante: r.penaltis_visitante,
        kickoff_at: r.kickoff_at,
      });
    }

    // ---- 2) Particiona em "precisa upsert" vs "tudo igual" ----
    // Regra: UPSERT só se a partida é NOVA ou se mudou algum campo de pontuação.
    // Metadado isolado (slug/escudo/fase) entra no próximo full sync diário sem
    // gerar UPDATE no Postgres em todo tick.
    const toUpsert: ProviderMatchV2[] = [];
    for (const m of unique) {
      const key = matchDedupeKey(m);
      const prev = prevByKey.get(key);
      if (!prev) {
        toUpsert.push(m);
        writtenMatchIds.push(m.matchId);
        scoredChangedIds.push(m.matchId);
        if (
          (m.resultCasa != null && m.resultCasa > 0) ||
          (m.resultVisitante != null && m.resultVisitante > 0)
        ) {
          placarChangedIds.push(m.matchId);
        }
        continue;
      }
      if (scoredFieldsChanged(prev, m)) {
        toUpsert.push(m);
        writtenMatchIds.push(m.matchId);
        scoredChangedIds.push(m.matchId);
        if (placarFieldsChanged(prev, m)) {
          placarChangedIds.push(m.matchId);
        }
      } else {
        unchanged += 1;
      }
    }

    if (toUpsert.length > 0) {
      const upsertRows = dedupeMatches(toUpsert);
      if (upsertRows.length !== toUpsert.length) {
        console.warn(
          `[persistMatchesV2] dedupe extra no upsert: ${toUpsert.length} → ${upsertRows.length}`,
        );
      }
      for (let off = 0; off < upsertRows.length; off += MATCH_UPSERT_CHUNK) {
        const chunk = upsertRows.slice(off, off + MATCH_UPSERT_CHUNK);
        const values: string[] = [];
        const params: unknown[] = [];
        let p = 1;
        for (const m of chunk) {
          const placeholders: string[] = [];
          for (let i = 0; i < COLS_PER_ROW; i++) {
            placeholders.push(`$${p++}`);
          }
          values.push(`(${placeholders.join(", ")}, now(), now())`);
          params.push(...buildRow(m));
        }
        await client.query(MATCH_UPSERT_SQL.replace("%VALUES%", values.join(", ")), params);
      }
    }

    // ---- 3) Recompute prediction_scores SÓ para o que mudou pontuação ----
    if (scoredChangedIds.length > 0) {
      const r = await recomputePredictionScoresForMatches(client, scoredChangedIds);
      predictionScoresUpdated = r.updated;
    }

    await client.query("COMMIT");
    invalidateMatchMapMemoryAfterDbWrite();
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // ---- 4) Cascata: SÓ se houve mudança de pontuação ----
  if (scoredChangedIds.length > 0) {
    await runCascadeAfterMatchUpdate({
      source: opts?.cascadeSource ?? "persist-v2",
      runClosures: opts?.runCascadingClosures ?? true,
      placarChangedIds,
    }).catch((err) => {
      console.warn("[persistMatchesV2] cascade failed:", err);
    });
  }

  return {
    written: writtenMatchIds.length,
    changedMatchIds: writtenMatchIds,
    scoredChangedIds,
    deduped,
    unchanged,
    predictionScoresUpdated,
  };
}

/**
 * Cascata pos-update: marca cache em memoria como sujo, revalida ranking
 * (Next cache tag) e dispara o fechamento idempotente dos premios.
 *
 * Disparado tanto pelo cron diario quanto pelo worker de 1 min — cuida sozinha
 * dos bilhetes ja vendidos (predictions usam o `match_id`, entao basta o cache
 * de match_map e do leaderboard cairem).
 */
export async function runCascadeAfterMatchUpdate(opts: {
  source: string;
  runClosures?: boolean;
  placarChangedIds?: number[];
}): Promise<void> {
  invalidateMatchMapMemoryAfterDbWrite();

  if (opts.placarChangedIds && opts.placarChangedIds.length > 0) {
    void import("@/lib/push/score-change-notify")
      .then(({ dispatchScoreChangePushNotifications }) =>
        dispatchScoreChangePushNotifications(opts.placarChangedIds!),
      )
      .catch((err) => {
        console.warn("[runCascadeAfterMatchUpdate] score push failed", err);
      });
  }

  if (opts.runClosures !== false) {
    await processPrizeClosuresAfterMatchSync({ source: opts.source }).catch((err) => {
      console.warn("[runCascadeAfterMatchUpdate] processPrizeClosures", err);
    });
  }

  try {
    const { revalidateTag } = await import("next/cache");
    revalidateTag("leaderboard", "max");
  } catch {
    // fora do contexto de request — ignorado.
  }
}

// ---------------------------------------------------------------------
// championships_cache
// ---------------------------------------------------------------------

const CHAMP_UPSERT_SQL = `INSERT INTO championships_cache (
  competition_id, nome, slug, nome_popular, temporada,
  rodada_atual_numero, rodada_atual_slug, rodada_atual_nome, rodada_atual_status,
  fase_atual_nome, fase_atual_slug, status, logo, total_rodadas,
  raw_payload, fetched_at
) VALUES (
  $1, $2, $3, $4, $5,
  $6, $7, $8, $9,
  $10, $11, $12, $13, $14,
  $15, now()
)
ON CONFLICT (competition_id) DO UPDATE SET
  nome                  = EXCLUDED.nome,
  slug                  = EXCLUDED.slug,
  nome_popular          = COALESCE(EXCLUDED.nome_popular, championships_cache.nome_popular),
  temporada             = COALESCE(EXCLUDED.temporada, championships_cache.temporada),
  rodada_atual_numero   = COALESCE(EXCLUDED.rodada_atual_numero, championships_cache.rodada_atual_numero),
  rodada_atual_slug     = COALESCE(EXCLUDED.rodada_atual_slug, championships_cache.rodada_atual_slug),
  rodada_atual_nome     = COALESCE(EXCLUDED.rodada_atual_nome, championships_cache.rodada_atual_nome),
  rodada_atual_status   = COALESCE(EXCLUDED.rodada_atual_status, championships_cache.rodada_atual_status),
  fase_atual_nome       = COALESCE(EXCLUDED.fase_atual_nome, championships_cache.fase_atual_nome),
  fase_atual_slug       = COALESCE(EXCLUDED.fase_atual_slug, championships_cache.fase_atual_slug),
  status                = COALESCE(EXCLUDED.status, championships_cache.status),
  logo                  = COALESCE(EXCLUDED.logo, championships_cache.logo),
  total_rodadas         = COALESCE(EXCLUDED.total_rodadas, championships_cache.total_rodadas),
  raw_payload           = EXCLUDED.raw_payload,
  fetched_at            = now()`;

export async function persistChampionshipSnapshot(
  snapshot: ChampionshipSnapshotV2,
): Promise<void> {
  const pool = getPool();
  await pool.query(CHAMP_UPSERT_SQL, [
    snapshot.competitionId,
    snapshot.nome,
    snapshot.slug,
    snapshot.nomePopular,
    snapshot.temporada,
    snapshot.rodadaAtual?.numero ?? null,
    snapshot.rodadaAtual?.slug ?? null,
    snapshot.rodadaAtual?.nome ?? null,
    snapshot.rodadaAtual?.status ?? null,
    snapshot.faseAtual?.nome ?? null,
    snapshot.faseAtual?.slug ?? null,
    snapshot.status,
    snapshot.logo,
    snapshot.totalRodadas,
    snapshot.raw == null ? null : JSON.stringify(snapshot.raw),
  ]);
}

export type ChampionshipCacheRow = {
  competition_id: number;
  nome: string;
  slug: string;
  nome_popular: string | null;
  temporada: string | null;
  rodada_atual_numero: number | null;
  rodada_atual_slug: string | null;
  rodada_atual_nome: string | null;
  rodada_atual_status: string | null;
  fase_atual_nome: string | null;
  fase_atual_slug: string | null;
  status: string | null;
  logo: string | null;
  total_rodadas: number | null;
  fetched_at: string;
};

export async function readChampionshipSnapshot(
  competitionId: number,
): Promise<ChampionshipCacheRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<ChampionshipCacheRow>(
    `SELECT
       competition_id, nome, slug, nome_popular, temporada,
       rodada_atual_numero, rodada_atual_slug, rodada_atual_nome, rodada_atual_status,
       fase_atual_nome, fase_atual_slug, status, logo, total_rodadas,
       fetched_at::text
     FROM championships_cache
     WHERE competition_id = $1`,
    [competitionId],
  );
  return rows[0] ?? null;
}
