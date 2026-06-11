/**
 * Fonte única: `app/shared/elencos-copa-2026.json`
 * Usado pelo app (elencos.ts) e pelo script de migração no servidor.
 */
import elencosRaw from "@/app/shared/elencos-copa-2026.json";
import {
  comparePlayersByJerseyNumber,
  formatGrupo,
  formatPosicao,
  formatTeamDisplayName,
} from "@/lib/artilheiros/elencos-display";
import type { ArtilheiroPlayerSummary, ArtilheiroTeamSummary } from "@/lib/artilheiros/types";

const VALID_POSICOES = new Set(["Goalkeeper", "Defender", "Midfielder", "Attacker"]);

type ElencosVenue = {
  api_venue_id?: number;
  nome?: string;
  cidade?: string;
};

export type ElencosTeamJson = {
  api_team_id: number;
  nome: string;
  codigo: string;
  pais: string;
  fundado?: number;
  nacional?: boolean;
  logo: string;
  venue?: ElencosVenue;
  grupo?: string;
  rank?: number;
  descricao?: string | null;
};

export type ElencosPlayerJson = {
  api_player_id: number;
  nome: string;
  idade?: number;
  numero?: number;
  posicao: string;
  foto: string;
};

export type ElencosSelecaoJson = {
  encontrado: boolean;
  team: ElencosTeamJson;
  total_jogadores: number;
  jogadores: ElencosPlayerJson[];
};

export type ElencosCopa2026Json = {
  competicao: {
    nome: string;
    league_id: number;
    season: number;
    total_entradas_grupos: number;
    total_selecoes_unicas: number;
    atualizado_em: string;
    observacao?: string;
    finalizado_em?: string;
  };
  resumo: {
    selecoes_encontradas: number;
    selecoes_nao_encontradas: number;
    selecoes_sem_jogadores: number;
    total_jogadores: number;
  };
  selecoes: ElencosSelecaoJson[];
};

export type ElencosValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    rawSelecoes: number;
    uniqueTeams: number;
    uniquePlayers: number;
    expectedTeams: number;
    expectedPlayers: number;
    atualizadoEm: string;
  };
};

const DATA = elencosRaw as ElencosCopa2026Json;

export function getElencosRawData(): ElencosCopa2026Json {
  return DATA;
}

/** Preferência: grupo principal vs. ranking de 3º colocados. */
function teamEntryScore(sel: ElencosSelecaoJson): number {
  const grupo = sel.team.grupo?.trim() ?? "";
  if (grupo.startsWith("Group ")) return 100;
  if (grupo === "Ranking of third-placed teams") return 10;
  if (sel.team.descricao) return 20;
  return 50;
}

export function dedupeSelecoes(selecoes: ElencosSelecaoJson[]): ElencosSelecaoJson[] {
  const byTeamId = new Map<number, ElencosSelecaoJson>();
  for (const sel of selecoes) {
    if (!sel.encontrado || !sel.jogadores?.length) continue;
    const id = sel.team.api_team_id;
    const prev = byTeamId.get(id);
    if (!prev || teamEntryScore(sel) > teamEntryScore(prev)) {
      byTeamId.set(id, sel);
    }
  }
  return [...byTeamId.values()];
}

function mapTeam(sel: ElencosSelecaoJson): ArtilheiroTeamSummary {
  const t = sel.team;
  const grupo = t.grupo ?? null;
  return {
    apiTeamId: t.api_team_id,
    nome: t.nome,
    displayNome: formatTeamDisplayName(t.nome),
    codigo: t.codigo,
    pais: t.pais,
    logo: t.logo,
    grupo,
    grupoLabel: formatGrupo(grupo),
    totalJogadores: sel.total_jogadores,
    rank: t.rank ?? null,
    descricao: t.descricao ?? null,
  };
}

function mapPlayer(team: ElencosTeamJson, j: ElencosPlayerJson): ArtilheiroPlayerSummary {
  return {
    apiPlayerId: j.api_player_id,
    apiTeamId: team.api_team_id,
    nome: j.nome,
    idade: j.idade ?? null,
    numero: j.numero ?? null,
    posicao: j.posicao,
    posicaoLabel: formatPosicao(j.posicao),
    foto: j.foto,
    teamNome: team.nome,
    teamDisplayNome: formatTeamDisplayName(team.nome),
    teamLogo: team.logo,
    teamCodigo: team.codigo,
  };
}

export function buildElencosCatalog(): {
  teams: ArtilheiroTeamSummary[];
  playersByTeam: Map<number, ArtilheiroPlayerSummary[]>;
  playerById: Map<number, ArtilheiroPlayerSummary>;
  meta: {
    competicao: string;
    season: number;
    atualizadoEm: string;
    observacao: string | null;
    totalSelecoes: number;
    totalJogadores: number;
    totalEntradasGrupos: number;
  };
} {
  const unique = dedupeSelecoes(DATA.selecoes);
  const teams = unique.map(mapTeam).sort((a, b) => a.displayNome.localeCompare(b.displayNome, "pt-BR"));
  const playersByTeam = new Map<number, ArtilheiroPlayerSummary[]>();
  const playerById = new Map<number, ArtilheiroPlayerSummary>();

  for (const sel of unique) {
    const team = sel.team;
    const list = sel.jogadores
      .map((j) => mapPlayer(team, j))
      .sort(comparePlayersByJerseyNumber);
    playersByTeam.set(team.api_team_id, list);
    for (const p of list) playerById.set(p.apiPlayerId, p);
  }

  return {
    teams,
    playersByTeam,
    playerById,
    meta: {
      competicao: DATA.competicao.nome,
      season: DATA.competicao.season,
      atualizadoEm: DATA.competicao.atualizado_em,
      observacao: DATA.competicao.observacao ?? null,
      totalSelecoes: teams.length,
      totalJogadores: playerById.size,
      totalEntradasGrupos: DATA.competicao.total_entradas_grupos,
    },
  };
}

/** Valida estrutura do JSON antes de deploy ou migração. */
export function validateElencosJson(): ElencosValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!DATA.competicao?.nome) errors.push("competicao.nome ausente");
  if (!DATA.resumo) errors.push("resumo ausente");
  if (!Array.isArray(DATA.selecoes) || DATA.selecoes.length === 0) {
    errors.push("selecoes[] vazio ou ausente");
  }

  let playersWithoutPhoto = 0;
  let invalidPosicao = 0;

  for (const [i, sel] of DATA.selecoes.entries()) {
    if (!sel.encontrado) warnings.push(`selecoes[${i}] encontrado=false (${sel.team?.nome ?? "?"})`);
    const t = sel.team;
    if (!t?.api_team_id) errors.push(`selecoes[${i}]: team.api_team_id ausente`);
    if (!t?.nome?.trim()) errors.push(`selecoes[${i}]: team.nome ausente`);
    if (!t?.codigo?.trim()) errors.push(`selecoes[${i}]: team.codigo ausente`);
    if (!t?.logo?.trim()) warnings.push(`selecoes[${i}]: team.logo ausente (${t?.nome})`);
    if (!Array.isArray(sel.jogadores)) {
      errors.push(`selecoes[${i}]: jogadores[] ausente (${t?.nome})`);
      continue;
    }
    for (const j of sel.jogadores) {
      if (!j.api_player_id) errors.push(`jogador sem api_player_id (${t?.nome})`);
      if (!j.nome?.trim()) errors.push(`jogador sem nome (team ${t?.nome})`);
      if (!j.posicao?.trim()) errors.push(`jogador sem posicao (${j.nome})`);
      else if (!VALID_POSICOES.has(j.posicao)) invalidPosicao += 1;
      if (!j.foto?.trim()) playersWithoutPhoto += 1;
    }
  }

  const unique = dedupeSelecoes(DATA.selecoes);
  const catalog = buildElencosCatalog();
  const uniquePlayers = catalog.playerById.size;

  if (DATA.selecoes.length > unique.length) {
    warnings.push(
      `${DATA.selecoes.length - unique.length} entrada(s) duplicada(s) de seleção (ranking 3º colocados) — deduplicadas automaticamente`,
    );
  }
  if (DATA.competicao.total_selecoes_unicas !== unique.length) {
    warnings.push(
      `competicao.total_selecoes_unicas=${DATA.competicao.total_selecoes_unicas}, deduplicado=${unique.length}`,
    );
  }
  if (DATA.resumo.total_jogadores !== uniquePlayers) {
    warnings.push(`resumo.total_jogadores=${DATA.resumo.total_jogadores}, catálogo deduplicado=${uniquePlayers}`);
  }
  if (invalidPosicao > 0) warnings.push(`${invalidPosicao} jogador(es) com posicao desconhecida`);
  if (playersWithoutPhoto > 0) warnings.push(`${playersWithoutPhoto} jogador(es) sem foto`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      rawSelecoes: DATA.selecoes.length,
      uniqueTeams: unique.length,
      uniquePlayers,
      expectedTeams: DATA.competicao.total_selecoes_unicas,
      expectedPlayers: DATA.resumo.total_jogadores,
      atualizadoEm: DATA.competicao.atualizado_em,
    },
  };
}
