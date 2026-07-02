import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";

/**
 * Carteira — núcleo do saldo.
 *
 * Toda mudança de saldo passa por aqui: 1 linha imutável no `wallet_ledger`
 * + atualização do cache (`users.balance_cents` ou `users.affiliate_balance_cents`,
 * conforme `account`), na MESMA transação, com `SELECT ... FOR UPDATE` no
 * usuário. Idempotente por `idempotencyKey`.
 *
 * O usuário enxerga UM saldo só (carteira + afiliado somados) — usado pra
 * comprar e sacar. No banco continuam 2 colunas separadas, e o ledger audita
 * cada uma: SUM(wallet_ledger WHERE account='wallet') == users.balance_cents,
 * SUM(wallet_ledger WHERE account='affiliate') == users.affiliate_balance_cents.
 */

export type WalletMovementType =
  | "deposit_pix"
  | "purchase"
  | "prize"
  | "withdrawal"
  | "refund"
  | "adjustment"
  | "commission";

export type WalletAccount = "wallet" | "affiliate";

export type WalletMovementInput = {
  userId: string;
  /** positivo = crédito, negativo = débito. Nunca 0. */
  amountCents: number;
  type: WalletMovementType;
  /** Impede aplicar o mesmo movimento duas vezes (ex.: retry de webhook). */
  idempotencyKey: string;
  transactionId?: string | null;
  metadata?: Record<string, unknown>;
  /** Qual coluna o movimento afeta. Default 'wallet'. */
  account?: WalletAccount;
};

export type WalletMovementResult = {
  /** false quando o movimento já havia sido aplicado (idempotência). */
  applied: boolean;
  /** Saldo da CONTA afetada (wallet ou affiliate) após o movimento. */
  balanceCents: number;
  /** Saldo total do usuário (wallet + afiliado) após o movimento. */
  totalBalanceCents: number;
  ledgerId: string | null;
};

/** Saldo insuficiente para um débito. Erro de negócio (não 500). */
export class WalletInsufficientFundsError extends Error {
  readonly code = "WALLET_INSUFFICIENT_FUNDS";
  constructor(
    readonly availableCents: number,
    readonly requestedCents: number
  ) {
    super("Saldo insuficiente");
    this.name = "WalletInsufficientFundsError";
  }
}

/** Canal único de notificação; o SSE filtra pelo userId do payload. */
export const WALLET_NOTIFY_CHANNEL = "wallet_balance";

function assertValidInput(input: WalletMovementInput): void {
  const userId = input.userId?.trim();
  if (!userId) throw new Error("userId obrigatorio");
  if (!Number.isInteger(input.amountCents) || input.amountCents === 0) {
    throw new Error("amountCents deve ser inteiro diferente de zero");
  }
  if (!input.idempotencyKey?.trim()) {
    throw new Error("idempotencyKey obrigatorio");
  }
}

/**
 * Aplica um movimento DENTRO de uma transação já aberta pelo chamador
 * (o chamador é dono do BEGIN/COMMIT). Use quando o movimento precisa ser
 * atômico junto de outra escrita — ex.: debitar + criar tickets na compra.
 *
 * Pré-condição: `client` já está em BEGIN.
 */
export async function applyWalletMovementTx(
  client: PoolClient,
  input: WalletMovementInput
): Promise<WalletMovementResult> {
  assertValidInput(input);
  const userId = input.userId.trim();
  const key = input.idempotencyKey.trim();
  const account: WalletAccount = input.account ?? "wallet";
  const column = account === "affiliate" ? "affiliate_balance_cents" : "balance_cents";

  // 1) Trava a linha do usuário (lê as 2 colunas para poder notificar o total).
  const locked = await client.query<{ balance_cents: number | null; affiliate_balance_cents: number | null }>(
    `SELECT balance_cents, affiliate_balance_cents FROM users WHERE id = $1::uuid FOR UPDATE`,
    [userId]
  );
  const userRow = locked.rows[0];
  if (!userRow) throw new Error("Usuario nao encontrado");
  const currentBalance =
    account === "affiliate" ? userRow.affiliate_balance_cents ?? 0 : userRow.balance_cents ?? 0;
  const currentTotal = (userRow.balance_cents ?? 0) + (userRow.affiliate_balance_cents ?? 0);

  // 2) Idempotência: se já existe esse movimento, não muta nada.
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM wallet_ledger WHERE idempotency_key = $1`,
    [key]
  );
  if (existing.rows[0]) {
    return {
      applied: false,
      balanceCents: currentBalance,
      totalBalanceCents: currentTotal,
      ledgerId: existing.rows[0].id,
    };
  }

  // 3) Débito não pode deixar a conta afetada negativa.
  const newBalance = currentBalance + input.amountCents;
  if (input.amountCents < 0 && newBalance < 0) {
    throw new WalletInsufficientFundsError(currentBalance, -input.amountCents);
  }

  // 4) Registra o movimento (ON CONFLICT protege contra corrida com chave igual).
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO wallet_ledger
       (user_id, amount_cents, type, status, transaction_id, idempotency_key, balance_after, metadata, account)
     VALUES ($1::uuid, $2, $3, 'settled', $4, $5, $6, $7::jsonb, $8)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [
      userId,
      input.amountCents,
      input.type,
      input.transactionId ?? null,
      key,
      newBalance,
      JSON.stringify(input.metadata ?? {}),
      account,
    ]
  );
  if (!inserted.rows[0]) {
    // Corrida: outra transação inseriu a mesma chave. Não aplica de novo.
    return { applied: false, balanceCents: currentBalance, totalBalanceCents: currentTotal, ledgerId: null };
  }

  // 5) Atualiza o cache de saldo da conta afetada. Como seguramos o FOR UPDATE, ninguém alterou no meio.
  const updated = await client.query<{ balance_cents: number; affiliate_balance_cents: number }>(
    `UPDATE users
       SET ${column} = COALESCE(${column}, 0) + $2,
           updated_at = now()
     WHERE id = $1::uuid
     RETURNING balance_cents, affiliate_balance_cents`,
    [userId, input.amountCents]
  );
  const row = updated.rows[0];
  const finalBalance = (account === "affiliate" ? row?.affiliate_balance_cents : row?.balance_cents) ?? newBalance;
  if (finalBalance < 0) throw new Error("Estado de saldo invalido apos movimento");
  const finalTotal = (row?.balance_cents ?? 0) + (row?.affiliate_balance_cents ?? 0);

  // 6) Notifica com o TOTAL (entregue só no COMMIT — NOTIFY é transacional).
  await client.query(`SELECT pg_notify($1, $2)`, [
    WALLET_NOTIFY_CHANNEL,
    JSON.stringify({ userId, balanceCents: finalTotal }),
  ]);

  return {
    applied: true,
    balanceCents: finalBalance,
    totalBalanceCents: finalTotal,
    ledgerId: inserted.rows[0].id,
  };
}

/**
 * Aplica um movimento gerenciando a própria transação. Use para movimentos
 * isolados (depósito confirmado, prêmio, estorno).
 */
export async function applyWalletMovement(
  input: WalletMovementInput
): Promise<WalletMovementResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await applyWalletMovementTx(client, input);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type CombinedDebitResult = {
  affiliateDebitedCents: number;
  walletDebitedCents: number;
  totalBalanceCents: number;
};

/**
 * Debita um valor do saldo TOTAL do usuário (carteira + afiliado), drenando
 * o afiliado primeiro. Usado por compra e saque — o usuário vê 1 saldo só,
 * mas o banco continua com 2 colunas, cada uma com sua trilha no ledger.
 *
 * `idempotencyKeyBase` gera até 2 chaves (`:affiliate` / `:wallet`) — cada
 * uma protegida individualmente contra reaplicação.
 */
export async function applyCombinedDebitTx(
  client: PoolClient,
  input: {
    userId: string;
    /** Positivo — valor total a debitar. */
    amountCents: number;
    type: WalletMovementType;
    idempotencyKeyBase: string;
    transactionId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<CombinedDebitResult> {
  const userId = input.userId.trim();
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("amountCents deve ser inteiro positivo");
  }

  const locked = await client.query<{ balance_cents: number | null; affiliate_balance_cents: number | null }>(
    `SELECT balance_cents, affiliate_balance_cents FROM users WHERE id = $1::uuid FOR UPDATE`,
    [userId]
  );
  const row = locked.rows[0];
  if (!row) throw new Error("Usuario nao encontrado");
  const wallet = row.balance_cents ?? 0;
  const affiliate = row.affiliate_balance_cents ?? 0;
  const total = wallet + affiliate;

  if (input.amountCents > total) {
    throw new WalletInsufficientFundsError(total, input.amountCents);
  }

  // Afiliado primeiro, depois carteira.
  const affiliatePortion = Math.min(affiliate, input.amountCents);
  const walletPortion = input.amountCents - affiliatePortion;

  let totalAfter = total;
  if (affiliatePortion > 0) {
    const r = await applyWalletMovementTx(client, {
      userId,
      amountCents: -affiliatePortion,
      type: input.type,
      idempotencyKey: `${input.idempotencyKeyBase}:affiliate`,
      transactionId: input.transactionId,
      metadata: { ...(input.metadata ?? {}), combinedDebit: true },
      account: "affiliate",
    });
    totalAfter = r.totalBalanceCents;
  }
  if (walletPortion > 0) {
    const r = await applyWalletMovementTx(client, {
      userId,
      amountCents: -walletPortion,
      type: input.type,
      idempotencyKey: `${input.idempotencyKeyBase}:wallet`,
      transactionId: input.transactionId,
      metadata: { ...(input.metadata ?? {}), combinedDebit: true },
      account: "wallet",
    });
    totalAfter = r.totalBalanceCents;
  }

  return { affiliateDebitedCents: affiliatePortion, walletDebitedCents: walletPortion, totalBalanceCents: totalAfter };
}

export type WalletLedgerEntry = {
  id: string;
  amountCents: number;
  type: string;
  status: string;
  account: WalletAccount;
  balanceAfter: number;
  createdAt: string;
};

/** Extrato (mais recentes primeiro), paginado — inclui os 2 lados (carteira e afiliado). */
export async function listWalletEntries(
  userId: string,
  opts: { limit?: number; before?: string | null } = {}
): Promise<WalletLedgerEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const before = opts.before?.trim() || null;
  const { rows } = await getPool().query<{
    id: string;
    amount_cents: string;
    type: string;
    status: string;
    account: string;
    balance_after: string;
    created_at: Date;
  }>(
    `SELECT id, amount_cents, type, status, account, balance_after, created_at
       FROM wallet_ledger
      WHERE user_id = $1::uuid
        AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
      ORDER BY created_at DESC
      LIMIT $3`,
    [userId.trim(), before, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    amountCents: Number(r.amount_cents),
    type: r.type,
    status: r.status,
    account: r.account === "affiliate" ? "affiliate" : "wallet",
    balanceAfter: Number(r.balance_after),
    createdAt: r.created_at.toISOString(),
  }));
}

export type WalletAggregates = {
  /** Saldo TOTAL disponível (carteira + afiliado) — o que o usuário vê e usa. */
  balanceCents: number;
  /** Quanto do saldo total vem de comissão de afiliado (informativo). */
  affiliateBalanceCents: number;
  /** Saques pendentes/em processamento — valor já debitado, aguardando pagamento. */
  blockedCents: number;
  totalDepositedCents: number;
  totalWithdrawnCents: number;
  totalWonCents: number;
  totalSpentCents: number;
};

/** Resumo financeiro do usuário (Central Financeira). */
export async function getWalletAggregates(userId: string): Promise<WalletAggregates> {
  const id = userId.trim();
  const pool = getPool();

  const [ledgerRes, withdrawRes, balanceRes] = await Promise.all([
    pool.query<{ deposited: string; won: string; spent: string }>(
      `SELECT
         COALESCE(SUM(amount_cents) FILTER (WHERE type = 'deposit_pix'), 0)::text AS deposited,
         COALESCE(SUM(amount_cents) FILTER (WHERE type = 'prize'), 0)::text       AS won,
         COALESCE(-SUM(amount_cents) FILTER (WHERE type = 'purchase'), 0)::text    AS spent
       FROM wallet_ledger WHERE user_id = $1::uuid`,
      [id]
    ),
    // Todos os saques do usuário contam, seja qual for a origem (unificado).
    pool.query<{ blocked: string; withdrawn: string }>(
      `SELECT
         COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('pending', 'processing')), 0)::text AS blocked,
         COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('approved', 'paid')), 0)::text       AS withdrawn
       FROM affiliate_withdrawal_requests
       WHERE user_id = $1::uuid`,
      [id]
    ),
    pool.query<{ balance_cents: number | null; affiliate_balance_cents: number | null }>(
      `SELECT balance_cents, affiliate_balance_cents FROM users WHERE id = $1::uuid`,
      [id]
    ),
  ]);

  const l = ledgerRes.rows[0];
  const w = withdrawRes.rows[0];
  const wallet = balanceRes.rows[0]?.balance_cents ?? 0;
  const affiliate = balanceRes.rows[0]?.affiliate_balance_cents ?? 0;
  return {
    balanceCents: wallet + affiliate,
    affiliateBalanceCents: affiliate,
    blockedCents: Number(w?.blocked ?? 0),
    totalDepositedCents: Number(l?.deposited ?? 0),
    totalWithdrawnCents: Number(w?.withdrawn ?? 0),
    totalWonCents: Number(l?.won ?? 0),
    totalSpentCents: Number(l?.spent ?? 0),
  };
}

/** Saldo TOTAL disponível (carteira + afiliado). */
export async function getWalletBalanceCents(userId: string): Promise<number> {
  const { rows } = await getPool().query<{ balance_cents: number | null; affiliate_balance_cents: number | null }>(
    `SELECT balance_cents, affiliate_balance_cents FROM users WHERE id = $1::uuid`,
    [userId.trim()]
  );
  const r = rows[0];
  return (r?.balance_cents ?? 0) + (r?.affiliate_balance_cents ?? 0);
}
