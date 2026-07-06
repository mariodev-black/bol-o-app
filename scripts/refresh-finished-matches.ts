/**
 * Atualiza placares da API + recomputa pontuação + invalida ranking.
 * Uso: npx tsx scripts/refresh-finished-matches.ts [match_id ...]
 */
import fs from "node:fs";
import pg from "pg";
import { recomputePredictionScoresForMatches } from "../lib/predictions/score-recompute";
import { runCascadeAfterMatchUpdate } from "../lib/football/persistence";

const DEFAULT_MATCH_IDS = [32342, 32344, 32343, 32379];

function loadEnv() {
  const envPath = new URL("../.env", import.meta.url);
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i);
    let v = t.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] == null) process.env[k] = v;
  }
}

function pickScores(p: Record<string, unknown>) {
  const casa = p.placar_mandante ?? p.placar_casa ?? null;
  const vis = p.placar_visitante ?? null;
  if (casa != null && vis != null) {
    return { casa: Number(casa), vis: Number(vis) };
  }
  const m = String(p.placar ?? "").match(/(\d+)\s*[xX]\s*(\d+)/);
  if (m) return { casa: Number(m[1]), vis: Number(m[2]) };
  return null;
}

async function main() {
  loadEnv();
  const token = process.env.FOOTBALL_API_TOKEN?.trim();
  if (!token) throw new Error("FOOTBALL_API_TOKEN ausente");

  const matchIds = (process.argv.slice(2).map(Number).filter((n) => n > 0).length
    ? process.argv.slice(2).map(Number).filter((n) => n > 0)
    : DEFAULT_MATCH_IDS);

  const url = new URL(process.env.DATABASE_URL!);
  const pool = new pg.Pool({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
  });

  const updated: number[] = [];

  for (const matchId of matchIds) {
    const res = await fetch(`https://api.api-futebol.com.br/v1/partidas/${matchId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn(`#${matchId} API HTTP ${res.status} — pulando`);
      continue;
    }
    const p = (await res.json()) as Record<string, unknown>;
    const scores = pickScores(p);
    if (!scores) {
      console.warn(`#${matchId} sem placar oficial na API — pulando`);
      continue;
    }
    const status = String(p.status ?? "finalizado");
    const payload = JSON.stringify(p);

    for (const compId of [72, 90007]) {
      const r = await pool.query(
        `UPDATE matches_cache
            SET status = $3,
                result_casa = $4,
                result_visitante = $5,
                provider_payload = $6::jsonb,
                synced_at = now()
          WHERE competition_id = $1 AND match_id = $2
          RETURNING home_sigla, away_sigla, date_br, hour_br`,
        [compId, matchId, status, scores.casa, scores.vis, payload],
      );
      if (r.rowCount) {
        const row = r.rows[0];
        console.log(
          `placar comp ${compId} #${matchId} ${row.home_sigla} ${scores.casa}x${scores.vis} ${row.away_sigla} [${row.date_br}]`,
        );
      }
    }
    updated.push(matchId);
  }

  if (updated.length === 0) {
    console.log("Nenhum jogo atualizado.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    const recompute = await recomputePredictionScoresForMatches(client, updated);
    console.log("prediction_scores:", recompute);
  } finally {
    client.release();
    await pool.end();
  }

  await runCascadeAfterMatchUpdate({
    source: "refresh-finished-matches",
    runClosures: false,
    placarChangedIds: updated,
  }).catch((err) => console.warn("cascade:", err));

  console.log("Concluído — ranking invalidado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
