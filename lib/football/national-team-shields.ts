/**
 * Escudos de seleções — URLs da API-Futebol (campeonato 72 / Copa).
 * Atualize com `npx tsx scripts/fetch-national-team-shields.ts`.
 */

export type NationalTeamShieldEntry = {
  name: string;
  shieldUrl: string;
};

/** Lista canônica (nome popular da API). */
export const NATIONAL_TEAM_SHIELDS: readonly NationalTeamShieldEntry[] = [
  { name: "África do Sul", shieldUrl: "https://cdn.api-futebol.com.br/escudos/6403db927e96e.svg" },
  { name: "Alemanha", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca4a93956.svg" },
  { name: "Arábia Saudita", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fba761d593.png" },
  { name: "Argélia", shieldUrl: "https://cdn.api-futebol.com.br/escudos/6938b8432ad75.svg" },
  { name: "Argentina", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fc88283de6.svg" },
  { name: "Austrália", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca5a5919e.svg" },
  { name: "Áustria", shieldUrl: "https://cdn.api-futebol.com.br/escudos/638d351f26c38.svg" },
  { name: "Bélgica", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca458059f.svg" },
  { name: "Bósnia", shieldUrl: "https://cdn.api-futebol.com.br/escudos/69cce3d5b75da.svg" },
  { name: "Brasil", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fc899c4bf7.svg" },
  { name: "Cabo Verde", shieldUrl: "https://cdn.api-futebol.com.br/escudos/6938b84252e1b.svg" },
  { name: "Canadá", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fc8845dfb6.svg" },
  { name: "Catar", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fbb1947b51.png" },
  { name: "Colômbia", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fc897d03bd.svg" },
  { name: "Coreia do Sul", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca5db5bb8.svg" },
  { name: "Costa do Marfim", shieldUrl: "https://cdn.api-futebol.com.br/escudos/6938b84153db0.svg" },
  { name: "Croácia", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca3753bfa.svg" },
  { name: "Curaçao", shieldUrl: "https://cdn.api-futebol.com.br/escudos/6938b840b678c.svg" },
  { name: "Egito", shieldUrl: "https://cdn.api-futebol.com.br/escudos/68b23f0dd2450.svg" },
  { name: "Equador", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fc88c2e765.svg" },
  { name: "Escócia", shieldUrl: "https://cdn.api-futebol.com.br/escudos/638d3522e7860.svg" },
  { name: "Espanha", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca4331360.svg" },
  { name: "Estados Unidos", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fc89405609.svg" },
  { name: "França", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca473323b.svg" },
  { name: "Gana", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca63940f4.svg" },
  { name: "Haiti", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fc9e97cf07.svg" },
  { name: "Holanda", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca4c4ef37.svg" },
  { name: "Inglaterra", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca5528e65.svg" },
  { name: "Irã", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fbb3ad6d9b.png" },
  { name: "Iraque", shieldUrl: "https://cdn.api-futebol.com.br/escudos/69cce3d5e6f03.svg" },
  { name: "Japão", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca5c0db63.svg" },
  { name: "Jordânia", shieldUrl: "https://cdn.api-futebol.com.br/escudos/6938b8435fbc9.svg" },
  { name: "Marrocos", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca6889a75.svg" },
  { name: "México", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fc89f719fe.svg" },
  { name: "Noruega", shieldUrl: "https://cdn.api-futebol.com.br/escudos/6403db8610712.svg" },
  { name: "Nova Zelândia", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fbb8ad36f3.png" },
  { name: "Panamá", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca61e8182.svg" },
  { name: "Paraguai", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fc895f18f1.svg" },
  { name: "Portugal", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca34b8880.svg" },
  { name: "RD Congo", shieldUrl: "https://cdn.api-futebol.com.br/escudos/69cce3d60038f.svg" },
  { name: "República Tcheca", shieldUrl: "https://cdn.api-futebol.com.br/escudos/638d3523549e3.svg" },
  { name: "Senegal", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca66df398.svg" },
  { name: "Suécia", shieldUrl: "https://cdn.api-futebol.com.br/escudos/638d352528a2b.svg" },
  { name: "Suíça", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca3d17e40.svg" },
  { name: "Tunísia", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fbac14316a.png" },
  { name: "Turquia", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fca5192f8f.svg" },
  { name: "Uruguai", shieldUrl: "https://cdn.api-futebol.com.br/times/escudos/677fc8a1b9b21.svg" },
  { name: "Uzbequistão", shieldUrl: "https://cdn.api-futebol.com.br/escudos/6938b84488907.svg" },
] as const;

const ALIASES: Record<string, string> = {
  alemanha: "Alemanha",
  germany: "Alemanha",
  brasil: "Brasil",
  brazil: "Brasil",
  portugal: "Portugal",
  argentina: "Argentina",
  inglaterra: "Inglaterra",
  england: "Inglaterra",
  eua: "Estados Unidos",
  "estados unidos": "Estados Unidos",
  usa: "Estados Unidos",
  "nova zelandia": "Nova Zelândia",
  "nova zelândia": "Nova Zelândia",
  egito: "Egito",
  chile: "Chile",
  honduras: "Honduras",
  "el salvador": "El Salvador",
  venezuela: "Venezuela",
  bolivia: "Bolívia",
  "bosnia e herzegovina": "Bósnia",
  "bósnia e herzegovina": "Bósnia",
  bermudas: "Bermudas",
  aruba: "Aruba",
  "curacao": "Curaçao",
  "curaçao": "Curaçao",
};

function normalizeTeamKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const shieldByCanonical = new Map<string, string>(
  NATIONAL_TEAM_SHIELDS.map((e) => [normalizeTeamKey(e.name), e.shieldUrl]),
);

/**
 * Retorna URL do escudo da seleção (ou null se não mapeado).
 */
export function resolveNationalTeamShieldUrl(
  teamNameOrSigla: string | null | undefined,
): string | null {
  if (!teamNameOrSigla?.trim()) return null;
  const raw = teamNameOrSigla.trim();
  const key = normalizeTeamKey(raw);
  const alias = ALIASES[key];
  const canonical = alias ?? raw;
  return shieldByCanonical.get(normalizeTeamKey(canonical)) ?? null;
}

/** Todas as URLs únicas (ex.: allowlist Next/Image). */
export function listNationalTeamShieldUrls(): string[] {
  return [...new Set(NATIONAL_TEAM_SHIELDS.map((e) => e.shieldUrl))];
}
