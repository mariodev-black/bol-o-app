/** Índice do avatar preset (arquivos `app/assets/avatares/{0..4}.png`). */

export const AVATAR_INDEX_MIN = 0;
export const AVATAR_INDEX_MAX = 4;

export function clampAvatarIndex(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const i = Math.trunc(n);
  return Math.max(AVATAR_INDEX_MIN, Math.min(AVATAR_INDEX_MAX, i));
}

/** Valor inicial ao criar conta (0–4 inclusive). */
export function randomPresetAvatarIndex(): number {
  return AVATAR_INDEX_MIN + Math.floor(Math.random() * (AVATAR_INDEX_MAX - AVATAR_INDEX_MIN + 1));
}
