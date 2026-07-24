/**
 * Adiciona saldo na carteira do usuário de teste (teste@bolao.com).
 * Útil para testar compras com saldo no ambiente local/dev.
 *
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/seed-test-wallet-balance.ts [valor_em_reais]
 * Exemplo: npx tsx --tsconfig tsconfig.scripts.json scripts/seed-test-wallet-balance.ts 50.00
 */
import { getPool } from "@/lib/db";
import { applyWalletMovement } from "@/lib/wallet/ledger";

const EMAIL = "teste@bolao.com";
const DEFAULT_AMOUNT_REAIS = 50;

function parseAmount(argv: string[]): number {
  const raw = argv[2]?.trim().replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(raw ?? "");
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_AMOUNT_REAIS;
}

async function main() {
  const amountReais = parseAmount(process.argv);
  const amountCents = Math.round(amountReais * 100);

  const pool = getPool();
  const { rows } = await pool.query<{ id: string; balance_cents: number | null }>(
    "SELECT id, balance_cents FROM users WHERE email = lower(trim($1))",
    [EMAIL],
  );

  if (rows.length === 0) {
    console.error(`Usuário ${EMAIL} não encontrado. Rode primeiro:`);
    console.error("npx tsx --tsconfig tsconfig.scripts.json scripts/seed-test-user.ts");
    process.exit(1);
  }

  const userId = rows[0]!.id;
  const balanceBefore = rows[0]!.balance_cents ?? 0;

  const result = await applyWalletMovement({
    userId,
    amountCents,
    type: "adjustment",
    idempotencyKey: `seed-test-balance-${userId}-${Date.now()}`,
    metadata: { reason: "Seed de saldo para testes em dev", source: "seed-test-wallet-balance" },
    account: "wallet",
  });

  await pool.end();

  console.log("\n─────────────────────────────");
  console.log("  SALDO ADICIONADO");
  console.log("─────────────────────────────");
  console.log(`  Usuário: ${EMAIL}`);
  console.log(`  ID:      ${userId}`);
  console.log(`  Crédito: R$ ${(amountCents / 100).toFixed(2)}`);
  console.log(`  Antes:   R$ ${(balanceBefore / 100).toFixed(2)}`);
  console.log(`  Agora:   R$ ${(result.totalBalanceCents / 100).toFixed(2)}`);
  console.log("─────────────────────────────\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
