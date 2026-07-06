import fs from "node:fs";
import pg from "pg";
import { recomputePredictionScoresForMatches } from "../lib/predictions/score-recompute";

async function main() {
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

  const url = new URL(process.env.DATABASE_URL!);
  const pool = new pg.Pool({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    const ids = [32342, 32344, 32343, 32379, 32387];
    const r = await recomputePredictionScoresForMatches(client, ids);
    console.log("recomputed:", r);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
