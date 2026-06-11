/** Rótulos PT-BR das posições da API-Football (elencos-copa-2026.json). */
export const POSICAO_LABELS: Record<string, string> = {
  Goalkeeper: "Goleiro",
  Defender: "Zagueiro",
  Midfielder: "Meio-campo",
  Attacker: "Atacante",
};

/** Ordem no seletor de artilheiros (número da camisa, depois nome). */
export function comparePlayersByJerseyNumber(
  a: { numero: number | null; nome: string },
  b: { numero: number | null; nome: string },
): number {
  const na = a.numero ?? 9999;
  const nb = b.numero ?? 9999;
  if (na !== nb) return na - nb;
  return a.nome.localeCompare(b.nome, "pt-BR");
}

/** Ordem no seletor de artilheiros (atacantes primeiro). */
export const POSICAO_SORT_ORDER: Record<string, number> = {
  Attacker: 0,
  Midfielder: 1,
  Defender: 2,
  Goalkeeper: 3,
};

/** Nomes exibidos em PT-BR (chave = `team.nome` do JSON). */
export const TEAM_DISPLAY_NAMES: Record<string, string> = {
  Brazil: "Brasil",
  "Ivory Coast": "Costa do Marfim",
  "South Korea": "Coreia do Sul",
  "Saudi Arabia": "Arábia Saudita",
  USA: "Estados Unidos",
  Netherlands: "Holanda",
  Germany: "Alemanha",
  Switzerland: "Suíça",
  Morocco: "Marrocos",
  Croatia: "Croácia",
  Japan: "Japão",
  Poland: "Polônia",
  Wales: "País de Gales",
  Scotland: "Escócia",
  Turkey: "Turquia",
};

export function formatPosicao(posicao: string): string {
  return POSICAO_LABELS[posicao] ?? posicao;
}

export function formatGrupo(grupo: string | null | undefined): string | null {
  if (!grupo?.trim()) return null;
  const g = grupo.trim();
  if (g.startsWith("Group ")) return `Grupo ${g.slice(6)}`;
  if (g === "Ranking of third-placed teams") return "Melhores 3º colocados";
  return g;
}

export function formatTeamDisplayName(nome: string): string {
  return TEAM_DISPLAY_NAMES[nome] ?? nome;
}

export function comparePlayersForArtilheiroPicker(
  a: { posicao: string; numero: number | null; nome: string },
  b: { posicao: string; numero: number | null; nome: string },
): number {
  const pa = POSICAO_SORT_ORDER[a.posicao] ?? 9;
  const pb = POSICAO_SORT_ORDER[b.posicao] ?? 9;
  if (pa !== pb) return pa - pb;
  const na = a.numero ?? 999;
  const nb = b.numero ?? 999;
  if (na !== nb) return na - nb;
  return a.nome.localeCompare(b.nome, "pt-BR");
}
