import "server-only";

import { AMISTOSOS_FRIENDLY_MATCHES } from "@/lib/football/amistosos-friendlies";
import {
  finalizeAmistososFriendliesResults,
  type AmistososMatchResultInput,
} from "@/lib/football/amistosos-friendlies-finalize";
import {
  ensureAmistososFriendliesMatchesSeeded,
  listAmistososAdminMatches,
  type AmistososAdminMatchRow,
} from "@/lib/football/amistosos-friendlies-seed";

export type { AmistososMatchResultInput, AmistososAdminMatchRow };
export {
  finalizeAmistososFriendliesResults,
  ensureAmistososFriendliesMatchesSeeded,
  listAmistososAdminMatches,
};

export async function setAmistososMatchResult(
  matchId: number,
  resultCasa: number,
  resultVisitante: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isFinite(resultCasa) || !Number.isFinite(resultVisitante) || resultCasa < 0 || resultVisitante < 0) {
    return { ok: false, error: "Placar inválido." };
  }

  const allowed = new Set(AMISTOSOS_FRIENDLY_MATCHES.map((m) => m.matchId));
  if (!allowed.has(matchId)) {
    return { ok: false, error: "Partida não encontrada no bolão amistosos." };
  }

  await ensureAmistososFriendliesMatchesSeeded();

  const result = await finalizeAmistososFriendliesResults([
    { matchId, resultCasa, resultVisitante },
  ]);
  if (!result.ok) return result;
  return { ok: true };
}
