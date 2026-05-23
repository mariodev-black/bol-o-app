/**
 * Gera lista de telefones dos usuários cadastrados (dados sensíveis — não commitar).
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/export-registered-user-phones.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import { getPool } from "../lib/db";

const OUT = join(process.cwd(), "docs/USUARIOS-CADASTRADOS-NUMEROS.md");

async function main() {
  const pool = getPool();
  const { rows } = await pool.query<{ phone: string }>(
    `SELECT DISTINCT trim(phone) AS phone
     FROM users
     WHERE phone IS NOT NULL AND trim(phone) <> ''
     ORDER BY phone ASC`,
  );
  const { rows: totals } = await pool.query<{
    total_contas: number;
    com_telefone: number;
    sem_telefone: number;
  }>(
    `SELECT
       COUNT(*)::int AS total_contas,
       COUNT(*) FILTER (WHERE phone IS NOT NULL AND trim(phone) <> '')::int AS com_telefone,
       COUNT(*) FILTER (WHERE phone IS NULL OR trim(phone) = '')::int AS sem_telefone
     FROM users`,
  );
  const t = totals[0]!;
  const lines = [
    "# Usuários cadastrados — telefones",
    "",
    `Gerado em: ${new Date().toISOString()}`,
    "",
    "| Métrica | Quantidade |",
    "|---------|----------:|",
    `| Contas no banco | ${t.total_contas} |`,
    `| Com telefone | ${t.com_telefone} |`,
    `| Sem telefone | ${t.sem_telefone} |`,
    `| Telefones únicos (lista abaixo) | ${rows.length} |`,
    "",
    "## Lista",
    "",
    ...rows.map((r, i) => `${i + 1}. ${r.phone}`),
    "",
  ];
  writeFileSync(OUT, lines.join("\n"), "utf8");
  console.info("[export] escrito:", OUT);
  console.info("[export] telefones únicos:", rows.length);
  await pool.end();
}

main().catch((e) => {
  console.error("[export] falhou", e);
  process.exit(1);
});
