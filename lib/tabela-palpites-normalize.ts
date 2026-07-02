/**
 * Normaliza o JSON da API-Futebol `/campeonatos/{id}/tabela` para o formato esperado pela UI de Palpites
 * (objeto com chaves `grupo-*`, como na Copa).
 */

export type PalpitesTabelaGrupos = Record<string, PalpitesClassificacaoRow[]>;

export type PalpitesClassificacaoRow = {
  posicao: number;
  pontos: number;
  time: {
    time_id: number;
    nome_popular: string;
    sigla: string;
    escudo: string;
  };
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro?: number;
  golsContra?: number;
};

function normalizeRow(raw: unknown): PalpitesClassificacaoRow | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const time = item.time;
  if (!time || typeof time !== "object") return null;
  const t = time as Record<string, unknown>;
  const time_id = Number(t.time_id);
  if (!Number.isFinite(time_id)) return null;
  return {
    posicao: Number(item.posicao) || 0,
    pontos: Number(item.pontos) || 0,
    time: {
      time_id,
      nome_popular: String(t.nome_popular ?? t.sigla ?? ""),
      sigla: String(t.sigla ?? t.nome_popular ?? ""),
      escudo: String(t.escudo ?? ""),
    },
    jogos: Number(item.jogos) || 0,
    vitorias: Number(item.vitorias) || 0,
    empates: Number(item.empates) || 0,
    derrotas: Number(item.derrotas) || 0,
    golsPro: Number(item.gols_pro ?? item.golsPro) || 0,
    golsContra: Number(item.gols_contra ?? item.golsContra) || 0,
  };
}

/** Aceita array (Brasileirão), `fase-de-grupos` (Copa) ou mapa `grupo-a`/`grupo-b`. */
export function pickTabelaGruposForPalpites(data: unknown): PalpitesTabelaGrupos | null {
  if (data == null) return null;

  if (Array.isArray(data)) {
    const rows = data.map(normalizeRow).filter((r): r is PalpitesClassificacaoRow => r != null);
    if (rows.length === 0) return null;
    return { "grupo-geral": rows };
  }

  if (typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  if (Array.isArray(o.tabela)) {
    return pickTabelaGruposForPalpites(o.tabela);
  }

  if (o["fase-de-grupos"] && typeof o["fase-de-grupos"] === "object" && !Array.isArray(o["fase-de-grupos"])) {
    return o["fase-de-grupos"] as PalpitesTabelaGrupos;
  }

  if (Object.keys(o).some((key) => key.startsWith("grupo-"))) {
    return o as PalpitesTabelaGrupos;
  }

  const firstGrouped = Object.values(o).find(
    (value) =>
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).some((key) => key.startsWith("grupo-")),
  );
  return (firstGrouped as PalpitesTabelaGrupos) ?? null;
}
