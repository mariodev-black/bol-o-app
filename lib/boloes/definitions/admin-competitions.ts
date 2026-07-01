import { getPool } from "@/lib/db";
import {
  getFootballMainCompetitionId,
  parseExtraBolaoChampionshipIds,
} from "@/lib/boloes-extra-config";
import { getExtraBolaoHeroSideVariant } from "@/lib/boloes-extra-competition-branding";
import type { AdminCompetitionOption } from "@/lib/boloes/definitions/types";

/** IDs sintéticos de bolões (Skale, FDS, etc.) — não são campeonatos da API. */
const SYNTHETIC_COMPETITION_ID_MIN = 90_000;

/**
 * Campeonatos reais da API-Futebol para o admin (nome + id numérico da API).
 * Exclui pools/bolões sintéticos (900xx).
 */
export async function listAdminCompetitionOptions(): Promise<AdminCompetitionOption[]> {
  const pool = getPool();
  const envIds = [
    getFootballMainCompetitionId(),
    ...parseExtraBolaoChampionshipIds(),
  ].filter((id) => id > 0 && id < SYNTHETIC_COMPETITION_ID_MIN);

  const { rows } = await pool.query<{
    competition_id: number;
    nome_popular: string | null;
    logo: string | null;
    rodada_atual_numero: number | null;
    rodada_atual_nome: string | null;
  }>(
    `SELECT competition_id, nome_popular, logo, rodada_atual_numero, rodada_atual_nome
       FROM championships_cache
      WHERE competition_id < $1
      ORDER BY nome_popular ASC NULLS LAST, competition_id ASC`,
    [SYNTHETIC_COMPETITION_ID_MIN],
  );

  const byId = new Map(rows.map((r) => [Number(r.competition_id), r]));

  for (const id of envIds) {
    if (!byId.has(id)) {
      byId.set(id, {
        competition_id: id,
        nome_popular: `Campeonato ${id}`,
        logo: null,
        rodada_atual_numero: null,
        rodada_atual_nome: null,
      });
    }
  }

  const ids = [...byId.keys()].sort((a, b) => {
    const na = byId.get(a)?.nome_popular ?? "";
    const nb = byId.get(b)?.nome_popular ?? "";
    return na.localeCompare(nb, "pt-BR") || a - b;
  });

  return ids.map((id) => {
    const row = byId.get(id)!;
    const displayName = row.nome_popular?.trim() || `Campeonato ${id}`;
    return {
      id,
      displayName,
      logoUrl: row.logo?.trim() ? row.logo.trim() : null,
      iconVariant: getExtraBolaoHeroSideVariant(id, displayName),
      currentRound: row.rodada_atual_numero ?? null,
      currentRoundLabel: row.rodada_atual_nome ?? null,
      isSynthetic: false,
    };
  });
}
