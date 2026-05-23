/**
 * Gera README com cotas pagas (principal + extra) e e-mail de cada usuário.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/export-cotas-bolao-readme.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import { getPool } from "../lib/db";

const OUT = join(process.cwd(), "docs/COTAS-BOLAO-USUARIOS.md");

type Row = {
  email: string;
  name: string | null;
  ticket_type: "general" | "extra";
  linhas: number;
  cotas: number;
};

async function main() {
  const pool = getPool();

  const { rows } = await pool.query<Row>(
    `SELECT
       lower(trim(u.email)) AS email,
       (array_agg(u.name ORDER BY u.id))[1] AS name,
       t.ticket_type,
       COUNT(*)::int AS linhas,
       COALESCE(SUM(GREATEST(t.quantity, 1)), 0)::int AS cotas
     FROM tickets t
     INNER JOIN users u ON u.id = t.user_id
     WHERE t.status = 'paid'
       AND t.ticket_type IN ('general', 'extra')
       AND u.email IS NOT NULL
       AND trim(u.email) <> ''
     GROUP BY lower(trim(u.email)), t.ticket_type
     ORDER BY t.ticket_type, email`,
  );

  const principal = rows.filter((r) => r.ticket_type === "general");
  const extra = rows.filter((r) => r.ticket_type === "extra");

  const sumCotas = (list: Row[]) => list.reduce((a, r) => a + r.cotas, 0);
  const sumLinhas = (list: Row[]) => list.reduce((a, r) => a + r.linhas, 0);

  const principalCotas = sumCotas(principal);
  const extraCotas = sumCotas(extra);
  const principalUsers = principal.length;
  const extraUsers = extra.length;

  const emailSetPrincipal = new Set(principal.map((r) => r.email));
  const emailSetExtra = new Set(extra.map((r) => r.email));
  const emAmbos = [...emailSetPrincipal].filter((e) => emailSetExtra.has(e)).length;

  const formatUserBlock = (list: Row[]) =>
    list
      .map(
        (r, i) =>
          `${i + 1}. **${r.cotas}** cota${r.cotas === 1 ? "" : "s"} — ${r.email}${r.name ? ` (${r.name.trim()})` : ""}`,
      )
      .join("\n");

  const md = [
    "# Cotas pagas — Bolão do Milhão (principal) e Extra",
    "",
    `Gerado em: ${new Date().toISOString()}`,
    "",
    "## Resumo",
    "",
    "| Bolão | Usuários com cota | Linhas no banco | Total de cotas (`quantity`) |",
    "|-------|------------------:|----------------:|----------------------------:|",
    `| **Bolão do Milhão** (\`general\` / principal) | ${principalUsers} | ${sumLinhas(principal)} | **${principalCotas}** |`,
    `| **Extra** (\`extra\`) | ${extraUsers} | ${sumLinhas(extra)} | **${extraCotas}** |`,
    `| **Total** | — | ${sumLinhas(rows)} | **${principalCotas + extraCotas}** |`,
    "",
    `Usuários com cota nos **dois** bolões: **${emAmbos}**`,
    "",
    "> Apenas tickets com `status = 'paid'`. Diário (\`daily\`) não entra nesta lista.",
    "",
    "---",
    "",
    `## Bolão do Milhão — principal (${principalCotas} cotas, ${principalUsers} e-mails)`,
    "",
    formatUserBlock(principal) || "_Nenhum._",
    "",
    "---",
    "",
    `## Bolão extra (${extraCotas} cotas, ${extraUsers} e-mails)`,
    "",
    formatUserBlock(extra) || "_Nenhum._",
    "",
    "---",
    "",
    "## Só e-mail (principal)",
    "",
    ...principal.map((r) => `- ${r.email}`),
    "",
    "---",
    "",
    "## Só e-mail (extra)",
    "",
    ...extra.map((r) => `- ${r.email}`),
    "",
  ].join("\n");

  writeFileSync(OUT, md, "utf8");
  console.info("[export] escrito:", OUT);
  console.info("[export] principal:", { usuarios: principalUsers, cotas: principalCotas });
  console.info("[export] extra:", { usuarios: extraUsers, cotas: extraCotas });
  await pool.end();
}

main().catch((e) => {
  console.error("[export] falhou", e);
  process.exit(1);
});
