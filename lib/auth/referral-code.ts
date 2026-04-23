import { getPool } from "@/lib/db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Comprimento padrão dos códigos novos (legados no banco podem ter até ~12). */
export const REFERRAL_CODE_LENGTH = 6;

/** Normaliza código digitado (maiúsculas, só letras/números, limite de tamanho). */
export function normalizeReferralCodeInput(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t.length === 0) return null;
  return t.slice(0, 12);
}

function randomSegment(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]!;
  }
  return s;
}

/** Gera um código único de indicação para um novo usuário. */
export async function allocateUniqueReferralCode(): Promise<string> {
  const pool = getPool();
  for (let attempt = 0; attempt < 40; attempt++) {
    const len = attempt < 28 ? REFERRAL_CODE_LENGTH : attempt < 36 ? 7 : 8;
    const candidate = randomSegment(len);
    const { rows } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = $1) AS exists`,
      [candidate]
    );
    if (!rows[0]?.exists) return candidate;
  }
  const fallback = randomSegment(REFERRAL_CODE_LENGTH) + randomSegment(REFERRAL_CODE_LENGTH);
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = $1) AS exists`,
    [fallback]
  );
  if (!rows[0]?.exists) return fallback;
  return `${randomSegment(4)}${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** Retorna o `id` do usuário dono do código, ou `null` se não existir. */
export async function findUserIdByReferralCode(code: string): Promise<string | null> {
  const normalized = normalizeReferralCodeInput(code);
  if (!normalized) return null;
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE referral_code = $1 LIMIT 1`,
    [normalized]
  );
  return rows[0]?.id ?? null;
}
