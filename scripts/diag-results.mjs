import pg from "pg";
import fs from "node:fs";
const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const get = (k) => { const m = env.match(new RegExp(`^${k}=(.*)$`, "m")); return m ? m[1].trim() : ""; };
const url = new URL(get("DATABASE_URL"));
const pool = new pg.Pool({ host: url.hostname, port: Number(url.port||5432), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.replace(/^\//,""), ssl: { rejectUnauthorized: false } });
const TOKEN = get("FOOTBALL_API_TOKEN");
const ids = [32343, 32379, 32342, 32344, 32387, 32386];
for (const comp of [72, 90007]) {
  const { rows } = await pool.query(
    `SELECT match_id, date_br, hour_br, home_sigla, away_sigla, status,
            result_casa, result_visitante, synced_at, phase_key,
            provider_payload->>'status' as pp_status,
            provider_payload->'placar_mandante' as pp_casa,
            provider_payload->'placar_visitante' as pp_vis
       FROM matches_cache WHERE competition_id=$1 AND match_id = ANY($2::int[]) ORDER BY match_id`,
    [comp, ids]);
  console.log(`\n=== DB comp ${comp} ===`);
  for (const r of rows) console.log(JSON.stringify(r));
}
await pool.end();
// Live API
for (const id of [32343, 32379]) {
  const r = await fetch(`https://api.api-futebol.com.br/v1/partidas/${id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = await r.json();
  const p = j;
  console.log(`\n=== API #${id} ===`);
  console.log(`status=${p.status} placar=${p.placar_mandante}x${p.placar_visitante} mandante=${p.time_mandante?.sigla} visitante=${p.time_visitante?.sigla}`);
  console.log(`placar_oficial:`, JSON.stringify(p.placar_oficial));
  console.log(`placar:`, JSON.stringify(p.placar));
}
