/**
 * Premiação fixa do bolão geral (principal) — valores operacionais acordados.
 * Ranking real no banco; pool e quantidade de premiados fixos.
 */

const DEFAULT_POOL_CENTS = 812_700; // R$ 8.127,00
const DEFAULT_WINNER_COUNT = 29;
const DEFAULT_PARTICIPANT_COUNT = 291;

function envInt(name: string, fallback: number, min = 0): number {
  const raw = (process.env[name] ?? "").trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

function envEnabled(name: string, defaultOn = true): boolean {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return defaultOn;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function isGeneralBolaoFixedPrizeEnabled(): boolean {
  return envEnabled("GENERAL_BOLAO_FIXED_PRIZE_ENABLED", true);
}

export function getGeneralBolaoFixedPoolCents(): number {
  return envInt("GENERAL_BOLAO_FIXED_POOL_CENTS", DEFAULT_POOL_CENTS, 1);
}

export function getGeneralBolaoFixedWinnerCount(): number {
  return envInt("GENERAL_BOLAO_FIXED_WINNER_COUNT", DEFAULT_WINNER_COUNT, 1);
}

export function getGeneralBolaoFixedParticipantCount(): number {
  return envInt(
    "GENERAL_BOLAO_FIXED_PARTICIPANT_COUNT",
    DEFAULT_PARTICIPANT_COUNT,
    1,
  );
}

export function formatGeneralBolaoFixedPoolLabel(): string {
  return (getGeneralBolaoFixedPoolCents() / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export const GENERAL_BOLAO_FIXED_PRIZE_COPY = {
  participants: DEFAULT_PARTICIPANT_COUNT,
  winners: DEFAULT_WINNER_COUNT,
  poolLabel: "R$ 8.127",
} as const;
