import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const connStr = (process.env.DATABASE_URL ?? '').replace('sslmode=require', 'sslmode=no-verify');
const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

// Find Carlos
const users = await pool.query(
  `SELECT id, email, name, nickname FROM users WHERE name ILIKE '%carlos%' OR nickname ILIKE '%carlos%' OR email ILIKE '%carlos%' ORDER BY name`,
);
console.log('=== CARLOS USERS ===');
users.rows.forEach(r => console.log(JSON.stringify(r)));

// Check ranking for general bolão - show top 15 with points
const ranking = await pool.query(`
  SELECT
    u.id::text as user_id,
    COALESCE(u.nickname, u.name, u.email) as display_name,
    t.id::text as ticket_id,
    SUM(
      CASE
        WHEN p.score_casa = m.result_casa AND p.score_visitante = m.result_visitante THEN 10
        WHEN (p.score_casa - p.score_visitante) = (m.result_casa - m.result_visitante) AND m.result_casa != m.result_visitante THEN 5
        WHEN SIGN(p.score_casa - p.score_visitante) = SIGN(m.result_casa - m.result_visitante) THEN 3
        ELSE 0
      END
    ) as points
  FROM predictions p
  JOIN tickets t ON t.id::text = p.ticket_id::text
  JOIN users u ON u.id = t.user_id
  JOIN matches_cache m ON m.match_id = p.match_id
  WHERE t.ticket_type = 'general'
    AND t.status = 'paid'
    AND m.result_casa IS NOT NULL
    AND m.result_visitante IS NOT NULL
  GROUP BY u.id, u.nickname, u.name, u.email, t.id
  ORDER BY points DESC
  LIMIT 20
`);
console.log('\n=== RANKING (computed) ===');
ranking.rows.forEach((r, i) => console.log(`${i+1}. ${r.display_name} (${r.ticket_id.slice(0,8)}) = ${r.points} pts`));

await pool.end();
