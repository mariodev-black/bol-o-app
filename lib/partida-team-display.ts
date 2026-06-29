import { resolveNationalTeamShieldUrl } from "@/lib/football/national-team-shields";

export type PartidaTeamLike = {
  time_id?: number | null;
  id?: number | null;
  nome?: string | null;
  nome_popular?: string | null;
  sigla?: string | null;
  escudo?: string | null;
};

export type StandingsRowLike = {
  posicao: number;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  time: {
    time_id: number;
    nome_popular: string;
    sigla: string;
    escudo: string;
  };
};

export type StandingsGruposLike = Record<string, StandingsRowLike[]>;

export type PartidaTeamDisplay = {
  nome: string;
  sigla: string;
  escudo: string | null;
  escudoFallback: string;
  siglaLabel: string;
  slotDetail: string | null;
  isKnockoutSlot: boolean;
};

export type KnockoutSlotRef = {
  rank: number;
  groups: string[];
};

const KNOCKOUT_SLOT_RE = /^(\d+)[°º]\s*([A-Z]+)?$/i;

function pickRawTeamLabel(team: PartidaTeamLike): string {
  return (
    team.sigla?.trim() ||
    team.nome_popular?.trim() ||
    team.nome?.trim() ||
    ""
  );
}

export function parseKnockoutSlotRef(raw: string): KnockoutSlotRef | null {
  const m = raw.trim().match(KNOCKOUT_SLOT_RE);
  if (!m) return null;
  const rank = Number(m[1]);
  if (!Number.isFinite(rank) || rank < 1) return null;
  const groups = (m[2] ?? "").toUpperCase().split("").filter(Boolean);
  return { rank, groups };
}

export function isKnockoutSlotTeam(team: PartidaTeamLike): boolean {
  const timeId = team.time_id ?? team.id;
  if (timeId != null && Number.isFinite(Number(timeId)) && Number(timeId) > 0) {
    return false;
  }
  const escudo = team.escudo?.trim();
  if (escudo) return false;
  return parseKnockoutSlotRef(pickRawTeamLabel(team)) != null;
}

function standingsRowStats(row: StandingsRowLike): {
  pontos: number;
  vitorias: number;
  jogos: number;
} {
  return {
    pontos: row.pontos,
    vitorias: row.vitorias,
    jogos: row.jogos,
  };
}

function pickStandingsRow(
  tabela: StandingsGruposLike,
  groupLetter: string,
  position: number,
): StandingsRowLike | null {
  const key = `grupo-${groupLetter.toLowerCase()}`;
  const rows = tabela[key];
  if (!rows?.length) return null;
  const row = rows.find((r) => r.posicao === position);
  if (!row?.time) return null;
  if (row.jogos <= 0) return null;
  return row;
}

export function resolveKnockoutSlotFromStandings(
  slot: KnockoutSlotRef,
  tabela: StandingsGruposLike | null | undefined,
): PartidaTeamLike | null {
  if (!tabela || slot.groups.length === 0) return null;

  if (slot.rank <= 2 && slot.groups.length === 1) {
    const row = pickStandingsRow(tabela, slot.groups[0], slot.rank);
    if (!row) return null;
    return {
      time_id: row.time.time_id,
      nome_popular: row.time.nome_popular,
      sigla: row.time.sigla,
      escudo: row.time.escudo || resolveNationalTeamShieldUrl(row.time.nome_popular),
    };
  }

  if (slot.rank === 3 && slot.groups.length > 1) {
    const candidates: Array<{ row: StandingsRowLike; stats: ReturnType<typeof standingsRowStats> }> =
      [];
    for (const groupLetter of slot.groups) {
      const row = pickStandingsRow(tabela, groupLetter, 3);
      if (!row) continue;
      candidates.push({ row, stats: standingsRowStats(row) });
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      if (b.stats.pontos !== a.stats.pontos) return b.stats.pontos - a.stats.pontos;
      if (b.stats.vitorias !== a.stats.vitorias) return b.stats.vitorias - a.stats.vitorias;
      return b.stats.jogos - a.stats.jogos;
    });
    const best = candidates[0]?.row;
    if (!best) return null;
    return {
      time_id: best.time.time_id,
      nome_popular: best.time.nome_popular,
      sigla: best.time.sigla,
      escudo: best.time.escudo || resolveNationalTeamShieldUrl(best.time.nome_popular),
    };
  }

  return null;
}

function formatPendingKnockoutSlot(slot: KnockoutSlotRef): PartidaTeamDisplay {
  const rankLabel = `${slot.rank}º`;

  if (slot.groups.length === 1) {
    const group = slot.groups[0];
    const slotDetail =
      slot.rank === 1
        ? `1º do Grupo ${group}`
        : slot.rank === 2
          ? `2º do Grupo ${group}`
          : `3º do Grupo ${group}`;
    return {
      nome: `${slotDetail} (a definir)`,
      sigla: `${rankLabel} ${group}`,
      escudo: null,
      escudoFallback: group,
      siglaLabel: "A DEFINIR",
      slotDetail,
      isKnockoutSlot: true,
    };
  }

  const groupsDots = slot.groups.join("·");
  const slotDetail =
    slot.rank === 3
      ? `Melhor 3º (${groupsDots})`
      : `${rankLabel} (${groupsDots})`;
  return {
    nome: `${slotDetail} (a definir)`,
    sigla: `${rankLabel} ${slot.groups.join("")}`,
    escudo: null,
    escudoFallback: rankLabel,
    siglaLabel: "A DEFINIR",
    slotDetail,
    isKnockoutSlot: true,
  };
}

function formatRealTeam(team: PartidaTeamLike, raw: string): PartidaTeamDisplay {
  const escudo =
    team.escudo?.trim() ||
    resolveNationalTeamShieldUrl(team.nome_popular ?? team.nome ?? team.sigla) ||
    null;
  const nome = (team.nome_popular?.trim() || team.nome?.trim() || raw || "A DEFINIR").toUpperCase();
  const sigla = (team.sigla?.trim() || team.nome_popular?.trim() || nome).toUpperCase();
  const siglaLabel = sigla.slice(0, 3);
  return {
    nome,
    sigla,
    escudo,
    escudoFallback: siglaLabel,
    siglaLabel,
    slotDetail: null,
    isKnockoutSlot: false,
  };
}

export function resolvePartidaTeamDisplay(
  team: PartidaTeamLike | null | undefined,
  options?: { tabela?: StandingsGruposLike | null },
): PartidaTeamDisplay {
  if (!team) {
    return {
      nome: "A DEFINIR",
      sigla: "---",
      escudo: null,
      escudoFallback: "?",
      siglaLabel: "A DEFINIR",
      slotDetail: null,
      isKnockoutSlot: false,
    };
  }

  const raw = pickRawTeamLabel(team);
  const slot = parseKnockoutSlotRef(raw);
  if (slot && isKnockoutSlotTeam(team)) {
    const resolved = resolveKnockoutSlotFromStandings(slot, options?.tabela);
    if (resolved) return formatRealTeam(resolved, pickRawTeamLabel(resolved));
    return formatPendingKnockoutSlot(slot);
  }

  return formatRealTeam(team, raw);
}

/** Rótulo curto abaixo do escudo. */
export function teamSiglaLabel(
  sigla?: string | null,
  alt?: string | null,
  slotDetail?: string | null,
): string {
  const display = resolvePartidaTeamDisplay({ sigla, nome_popular: alt });
  if (display.isKnockoutSlot) return display.siglaLabel;
  if (slotDetail) return display.siglaLabel;
  return display.siglaLabel;
}

/** Texto dentro do escudo quando não há imagem. */
export function teamEscudoFallbackLabel(sigla?: string | null, alt?: string | null): string {
  const display = resolvePartidaTeamDisplay({ sigla, nome_popular: alt });
  return display.escudoFallback;
}

export function partidaTeamToPayload(team: PartidaTeamLike | null | undefined): {
  time_id?: number | null;
  nome_popular: string;
  sigla: string;
  escudo: string | null;
} {
  if (!team) {
    return { nome_popular: "A definir", sigla: "---", escudo: null };
  }
  const nome =
    team.nome_popular?.trim() ||
    team.nome?.trim() ||
    team.sigla?.trim() ||
    "A definir";
  const sigla = team.sigla?.trim() || nome;
  const escudo = team.escudo?.trim() || null;
  const timeId = team.time_id ?? team.id ?? null;
  return {
    ...(timeId != null ? { time_id: timeId } : {}),
    nome_popular: nome,
    sigla,
    escudo,
  };
}

export function mapPartidaTeamToJogoSide(
  team: PartidaTeamLike | null | undefined,
  options?: { tabela?: StandingsGruposLike | null },
): {
  nome: string;
  sigla: string;
  escudo: string;
  isKnockoutSlot: boolean;
  slotDetail: string | null;
} {
  const d = resolvePartidaTeamDisplay(team, options);
  return {
    nome: d.nome,
    sigla: d.sigla,
    escudo: d.escudo ?? "",
    isKnockoutSlot: d.isKnockoutSlot,
    slotDetail: d.slotDetail,
  };
}
