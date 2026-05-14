/**
 * Bolões “extra”: mesma lógística do bolão do dia, porém restritos a outro(s) campeonato(s)
 * da API-Futebol (`campeonato_id`). Lista em `BOLOES_EXTRA_CHAMPIONSHIP_IDS`.
 */

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

/** IDs numéricos extras (ex.: `2,3` ou `2; 3`). */
export function parseExtraBolaoChampionshipIds(): number[] {
  const raw = env("BOLOES_EXTRA_CHAMPIONSHIP_IDS") || env("BOLOES_EXTRA");
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function getFootballMainCompetitionId(): number {
  return Number.parseInt(env("FOOTBALL_COMPETITION_ID") || "72", 10) || 72;
}

/** Principal + extras, sem duplicar. Usado em sync e leitura do `matches_cache`. */
export function getAllSyncedCompetitionIds(): number[] {
  const main = getFootballMainCompetitionId();
  const extras = parseExtraBolaoChampionshipIds();
  return [...new Set([main, ...extras])];
}

/** Preço unitário do ticket extra (default R$ 10,00). */
export function getExtraBolaoTicketUnitCents(): number {
  const n = Number.parseInt(env("TICKET_PRICE_EXTRA_BOLAO_CENTS") || "1000", 10);
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export function isConfiguredExtraChampionshipId(id: number): boolean {
  return parseExtraBolaoChampionshipIds().includes(id);
}

/** Um único extra em env (ex. `BOLOES_EXTRA_CHAMPIONSHIP_IDS=2`) — fallback quando o ticket não tem `extra_championship_id`. */
export function getSoleConfiguredExtraChampionshipId(): number | null {
  const ids = parseExtraBolaoChampionshipIds();
  return ids.length === 1 ? ids[0] ?? null : null;
}
