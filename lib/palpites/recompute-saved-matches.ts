import { getPool } from "@/lib/db";
import { recomputePredictionScoresForMatches } from "@/lib/predictions/score-recompute";

export async function recomputePredictionScoresForSavedMatches(
  matchIds: number[],
): Promise<void> {
  if (matchIds.length === 0) return;
  const unique = [...new Set(matchIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (unique.length === 0) return;

  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await recomputePredictionScoresForMatches(client, unique);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.warn("[palpites] recomputePredictionScores skipped:", err);
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("[palpites] recompute boot failed:", err);
  }
}
