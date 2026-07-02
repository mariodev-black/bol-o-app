import type { StandingsGruposLike, StandingsRowLike } from "@/lib/partida-team-display";
import { ANNEX_C_ROWS, ANNEX_C_WINNERS } from "@/lib/football/wc2026-third-place-annex-c";

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");
const GROUPS_PER_STAGE = 4;
const MATCHES_PER_GROUP = 3;

const THIRD_PLACE_LOOKUP = new Map<string, Record<string, string>>();
for (let i = 0; i < ANNEX_C_ROWS.length; i++) {
  const letters = ANNEX_C_ROWS[i]!;
  const byWinner: Record<string, string> = {};
  for (let j = 0; j < ANNEX_C_WINNERS.length; j++) {
    byWinner[ANNEX_C_WINNERS[j]!] = letters[j]!;
  }
  THIRD_PLACE_LOOKUP.set(letters.split("").sort().join(""), byWinner);
}

function rowStats(row: StandingsRowLike): {
  pontos: number;
  saldo: number;
  golsPro: number;
  vitorias: number;
  jogos: number;
} {
  const golsPro = row.golsPro ?? 0;
  const golsContra = row.golsContra ?? 0;
  return {
    pontos: row.pontos,
    saldo: golsPro - golsContra,
    golsPro,
    vitorias: row.vitorias,
    jogos: row.jogos,
  };
}

function sortedStandingsRows(rows: StandingsRowLike[]): StandingsRowLike[] {
  return [...rows].sort((a, b) => {
    const sa = rowStats(a);
    const sb = rowStats(b);
    if (sb.pontos !== sa.pontos) return sb.pontos - sa.pontos;
    if (sb.saldo !== sa.saldo) return sb.saldo - sa.saldo;
    if (sb.golsPro !== sa.golsPro) return sb.golsPro - sa.golsPro;
    if (sb.vitorias !== sa.vitorias) return sb.vitorias - sa.vitorias;
    return (a.time.sigla ?? "").localeCompare(b.time.sigla ?? "");
  });
}

function pickThirdInGroup(
  tabela: StandingsGruposLike,
  groupLetter: string,
): StandingsRowLike | null {
  const key = `grupo-${groupLetter.toLowerCase()}`;
  const rows = tabela[key];
  if (!rows?.length) return null;
  const third = sortedStandingsRows(rows)[2];
  if (!third?.time || third.jogos < MATCHES_PER_GROUP) return null;
  return third;
}

/** Todas as 12 chaves com 3 jogos por seleção (fase de grupos encerrada). */
export function isWc2026GroupStageComplete(tabela: StandingsGruposLike): boolean {
  for (const letter of GROUP_LETTERS) {
    const key = `grupo-${letter.toLowerCase()}`;
    const rows = tabela[key];
    if (!rows?.length || rows.length < GROUPS_PER_STAGE) return false;
    if (!rows.every((r) => r.jogos >= MATCHES_PER_GROUP)) return false;
  }
  return true;
}

/** Os 8 melhores terceiros colocados (critério FIFA: pts, saldo, gols pró). */
export function pickWc2026QualifyingThirdGroups(
  tabela: StandingsGruposLike,
): string[] {
  const thirds: Array<{ group: string; row: StandingsRowLike; stats: ReturnType<typeof rowStats> }> =
    [];
  for (const letter of GROUP_LETTERS) {
    const row = pickThirdInGroup(tabela, letter);
    if (!row) continue;
    thirds.push({ group: letter, row, stats: rowStats(row) });
  }
  if (thirds.length < 12) return [];
  thirds.sort((a, b) => {
    if (b.stats.pontos !== a.stats.pontos) return b.stats.pontos - a.stats.pontos;
    if (b.stats.saldo !== a.stats.saldo) return b.stats.saldo - a.stats.saldo;
    if (b.stats.golsPro !== a.stats.golsPro) return b.stats.golsPro - a.stats.golsPro;
    if (b.stats.vitorias !== a.stats.vitorias) return b.stats.vitorias - a.stats.vitorias;
    return a.group.localeCompare(b.group);
  });
  return thirds.slice(0, 8).map((t) => t.group);
}

/**
 * Grupo do terceiro colocado que enfrenta o campeão de `winnerGroup`,
 * conforme Annex C da FIFA (combinação dos 8 terceiros classificados).
 */
export function resolveWc2026ThirdPlaceOpponentGroup(
  winnerGroup: string,
  tabela: StandingsGruposLike,
): string | null {
  const winner = winnerGroup.trim().toUpperCase();
  if (!/^[A-L]$/.test(winner)) return null;
  if (!isWc2026GroupStageComplete(tabela)) return null;

  const qualifying = pickWc2026QualifyingThirdGroups(tabela);
  if (qualifying.length !== 8) return null;

  const combo = [...qualifying].sort().join("");
  const byWinner = THIRD_PLACE_LOOKUP.get(combo);
  if (!byWinner) return null;

  const opponentGroup = byWinner[winner];
  return opponentGroup && /^[A-L]$/.test(opponentGroup) ? opponentGroup : null;
}

export function isGroupStageCompleteForLetter(
  tabela: StandingsGruposLike,
  groupLetter: string,
): boolean {
  const key = `grupo-${groupLetter.toLowerCase()}`;
  const rows = tabela[key];
  if (!rows?.length || rows.length < GROUPS_PER_STAGE) return false;
  return rows.every((r) => r.jogos >= MATCHES_PER_GROUP);
}
