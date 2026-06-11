import { buildElencosCatalog } from "@/lib/artilheiros/elencos-json";
import type { ArtilheiroPlayerSummary, ArtilheiroTeamSummary } from "@/lib/artilheiros/types";

export type { ElencosCopa2026Json } from "@/lib/artilheiros/elencos-json";
export { validateElencosJson, dedupeSelecoes, getElencosRawData } from "@/lib/artilheiros/elencos-json";

const CATALOG = buildElencosCatalog();

export function getElencosMeta() {
  return CATALOG.meta;
}

export function listArtilheiroTeams(): ArtilheiroTeamSummary[] {
  return CATALOG.teams;
}

/** Catálogo serializável para hidratar o picker no cliente (sem fetch). */
export function getArtilheiroElencosBundle(): {
  teams: ArtilheiroTeamSummary[];
  playersByTeam: Record<number, ArtilheiroPlayerSummary[]>;
} {
  return {
    teams: CATALOG.teams,
    playersByTeam: Object.fromEntries(CATALOG.playersByTeam) as Record<
      number,
      ArtilheiroPlayerSummary[]
    >,
  };
}

export function listArtilheiroPlayersByTeam(apiTeamId: number): ArtilheiroPlayerSummary[] {
  return CATALOG.playersByTeam.get(apiTeamId) ?? [];
}

export function findArtilheiroPlayer(apiPlayerId: number): ArtilheiroPlayerSummary | null {
  return CATALOG.playerById.get(apiPlayerId) ?? null;
}

export function searchArtilheiroTeams(query: string): ArtilheiroTeamSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG.teams;
  return CATALOG.teams.filter(
    (t) =>
      t.nome.toLowerCase().includes(q) ||
      t.displayNome.toLowerCase().includes(q) ||
      t.codigo.toLowerCase().includes(q) ||
      t.pais.toLowerCase().includes(q) ||
      (t.grupo?.toLowerCase().includes(q) ?? false) ||
      (t.grupoLabel?.toLowerCase().includes(q) ?? false),
  );
}

export function searchArtilheiroPlayers(
  apiTeamId: number,
  query: string,
): ArtilheiroPlayerSummary[] {
  const base = listArtilheiroPlayersByTeam(apiTeamId);
  const q = query.trim().toLowerCase();
  if (!q) return base;
  return base.filter(
    (p) =>
      p.nome.toLowerCase().includes(q) ||
      p.posicao.toLowerCase().includes(q) ||
      p.posicaoLabel.toLowerCase().includes(q) ||
      String(p.numero ?? "").includes(q),
  );
}

export function isValidArtilheiroPlayer(apiPlayerId: number, apiTeamId: number): boolean {
  const p = CATALOG.playerById.get(apiPlayerId);
  return p != null && p.apiTeamId === apiTeamId;
}
