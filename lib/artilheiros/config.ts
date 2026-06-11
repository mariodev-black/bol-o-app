/** Pontuação por acerto exato de posição (slot 1 = artilheiro, 2 = vice, 3 = terceiro). */
export const ARTILHEIRO_SLOT_POINTS: Record<1 | 2 | 3, number> = {
  1: 50,
  2: 30,
  3: 20,
};

/** Bônus por jogador escolhido que terminar entre os 3 artilheiros oficiais. */
export const ARTILHEIRO_TOP3_BONUS = 10;

export const ARTILHEIRO_PICK_SLOTS = [1, 2, 3] as const;
export type ArtilheiroPickSlot = (typeof ARTILHEIRO_PICK_SLOTS)[number];

export const ARTILHEIRO_SLOT_LABELS: Record<ArtilheiroPickSlot, string> = {
  1: "Artilheiro",
  2: "2º artilheiro",
  3: "3º artilheiro",
};

export const ARTILHEIRO_SLOT_EMOJI: Record<ArtilheiroPickSlot, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export const ARTILHEIROS_BOLAO_TITLE = "Bolão dos Artilheiros";
export const ARTILHEIROS_BOLAO_SUBTITLE = "Copa do Mundo 2026";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

export function getArtilheirosTicketPriceCents(): number {
  const n = Number.parseInt(env("TICKET_PRICE_ARTILHEIROS_CENTS"), 10);
  return Number.isFinite(n) && n > 0 ? n : 2000;
}

export function isArtilheirosBolaoEnabled(): boolean {
  const s = env("TICKETS_ARTILHEIROS_ENABLED").toLowerCase();
  if (!s) return true;
  return s === "1" || s === "true" || s === "yes" || s === "on";
}
