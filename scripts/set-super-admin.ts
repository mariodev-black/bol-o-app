/**
 * Promove usuário a super_admin pelo e-mail.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/set-super-admin.ts mario@gmail.com
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import { getPool } from "../lib/db";

async function main() {
  const email = (process.argv[2] ?? "").trim();
  if (!email) {
    console.error("Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/set-super-admin.ts <email>");
    process.exit(1);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query<{ id: string; email: string; role: string }>(
      `UPDATE users SET role = 'super_admin'
       WHERE lower(trim(email)) = lower(trim($1))
       RETURNING id, email, role`,
      [email],
    );
    if (!r.rowCount) {
      console.error("[set-super-admin] usuário não encontrado:", email);
      process.exit(1);
    }
    console.info("[set-super-admin] OK", r.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[set-super-admin] falhou", e);
  process.exit(1);
});
