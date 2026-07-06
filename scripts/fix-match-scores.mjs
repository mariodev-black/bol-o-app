/**
 * Correção pontual: busca placar em /partidas/:id e grava em matches_cache.
 * Uso: node scripts/fix-match-scores.mjs 32343 32379
 */
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
};

const url = new URL(get("DATABASE_URL"));
const pool = new pg.Pool({
  host: url.hostname,
  port: Number(url.port || 5432),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
});

const TOKEN = get("FOOTBALL_API_TOKEN");
const matchIds = process.argv.slice(2).map(Number).filter((n) => n > 0);
if (matchIds.length === 0) {
  console.error("Uso: node scripts/fix-match-scores.mjs <match_id> [...]");
  process.exit(1);
}

function pickScores(p) {
  const casa = p.placar_mandante ?? p.placar_casa ?? null;
  const vis = p.placar_visitante ?? null;
  if (casa != null && vis != null) return { casa: Number(casa), vis: Number(vis) };
  const m = String(p.placar ?? "").match(/(\d+)\s*[xX]\s*(\d+)/);
  if (m) return { casa: Number(m[1]), vis: Number(m[2]) };
  return null;
}

for (const matchId of matchIds) {
  const res = await fetch(`https://api.api-futebol.com.br/v1/partidas/${matchId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    console.error(`#${matchId} API HTTP ${res.status}`);
    continue;
  }
  const p = await res.json();
  const scores = pickScores(p);
  if (!scores) {
    console.error(`#${matchId} sem placar na API`);
    continue;
  }
  const status = String(p.status ?? "finalizado");
  const payload = JSON.stringify(p);

  const { rows: comps } = await pool.query(
    `SELECT DISTINCT competition_id FROM matches_cache WHERE match_id = $1`,
    [matchId],
  );
  const compIds = comps.map((r) => r.competition_id);
  if (compIds.length === 0) {
    console.warn(`#${matchId} não encontrado em matches_cache`);
    continue;
  }

  for (const compId of compIds) {
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
        `comp ${compId} #${matchId} ${row.home_sigla} ${scores.casa}x${scores.vis} ${row.away_sigla} [${row.date_br} ${row.hour_br}] status=${status}`,
      );
    }
  }
}

await pool.end();
