import { getPool } from "@/lib/db";
import {
  EMAIL_TAG_CHECKOUT_RECOVERY,
  EMAIL_TAG_COMPROU_INDIQUE,
  EMAIL_TAG_INDIQUE_OFERTA,
  EMAIL_TAG_POS_COMPRA_UPSELL,
  EMAIL_TAG_PROVA_SOCIAL,
} from "@/lib/email/policy";
import {
  runDripFlow,
  type DripFlow,
  type DripRecipient,
  type RunDripFlowResult,
} from "@/lib/email/drip-engine";
import { POS_COMPRA_UPSELL_BUILDERS } from "@/lib/email/templates/pos-compra-upsell";
import { PROVA_SOCIAL_BUILDERS } from "@/lib/email/templates/prova-social";
import { COMPROU_INDIQUE_BUILDERS } from "@/lib/email/templates/comprou-indique";
import { CHECKOUT_RECOVERY_BUILDERS } from "@/lib/email/templates/checkout-recovery";
import { INDIQUE_OFERTA_BUILDERS } from "@/lib/email/templates/indique-oferta";

/**
 * CRM disparado por evento. Janelas em minutos (cron de hora em hora, janela de 120min
 * absorve atrasos; dedup por (flow_key, step, user) evita reenvio).
 *
 * Sequenciado para o mesmo usuário não receber 2 fluxos no mesmo horário:
 *  - Compradores: upsell (2h/24h/48h) → indique (3d/4d/5d)
 *  - Cadastrados sem compra: prova social (2h/24h/48h/72h) → recuperação (4d/5d/6d)
 *
 * Drips só pegam eventos DENTRO da janela — usuários antigos (cadastro/compra fora
 * da janela) não são reprocessados, então não há blast retroativo.
 */

type Window = { minAgo: number; maxAgo: number };
const WIN = 120; // largura da janela em minutos
const w = (minAgo: number): Window => ({ minAgo, maxAgo: minAgo + WIN });

const H = 60;
const D = 1440;

// ────────────────────────────────────────────────
// Queries de público
// ────────────────────────────────────────────────

type Row = { dedup_id: string; user_id: string; email: string; name: string | null };

function toRecipients(rows: Row[]): DripRecipient[] {
  return rows.map((r) => ({
    dedupId: r.dedup_id,
    userId: r.user_id,
    email: r.email,
    name: r.name,
  }));
}

/** Compradores: âncora = 1ª cota paga (tickets.paid_at). Opcional: só quem tem < 8 cotas. */
async function listBuyerRecipients(opts: {
  flowKey: string;
  stepId: string;
  win: Window;
  maxCotas?: number;
}): Promise<DripRecipient[]> {
  const pool = getPool();
  const cotaClause =
    opts.maxCotas != null
      ? `AND (
           SELECT COALESCE(SUM(t.quantity), 0)
           FROM tickets t
           WHERE t.user_id = u.id AND t.ticket_type = 'general' AND t.status = 'paid'
         ) < ${Math.trunc(opts.maxCotas)}`
      : "";

  const { rows } = await pool.query<Row>(
    `WITH first_paid AS (
       SELECT user_id, MIN(paid_at) AS bought_at
       FROM tickets
       WHERE status = 'paid' AND paid_at IS NOT NULL
       GROUP BY user_id
     )
     SELECT u.id::text AS dedup_id, u.id AS user_id, u.email, u.name
     FROM first_paid fp
     JOIN users u ON u.id = fp.user_id
     WHERE u.email IS NOT NULL AND trim(u.email) <> ''
       AND fp.bought_at >= now() - ($2 * INTERVAL '1 minute')
       AND fp.bought_at <  now() - ($1 * INTERVAL '1 minute')
       ${cotaClause}
       AND NOT EXISTS (
         SELECT 1 FROM email_drip_sends d
         WHERE d.flow_key = $3 AND d.step = $4 AND d.dedup_id = u.id::text
       )
       AND NOT EXISTS (
         SELECT 1 FROM email_unsubscribes eu
         WHERE eu.email_normalized = lower(trim(u.email))
       )
     ORDER BY fp.bought_at ASC
     LIMIT 1000`,
    [opts.win.minAgo, opts.win.maxAgo, opts.flowKey, opts.stepId],
  );
  return toRecipients(rows);
}

/** Cadastrados sem nenhuma compra paga. Âncora = users.created_at. */
async function listNonBuyerRecipients(opts: {
  flowKey: string;
  stepId: string;
  win: Window;
}): Promise<DripRecipient[]> {
  const pool = getPool();
  const { rows } = await pool.query<Row>(
    `SELECT u.id::text AS dedup_id, u.id AS user_id, u.email, u.name
     FROM users u
     WHERE u.email IS NOT NULL AND trim(u.email) <> ''
       AND u.created_at >= now() - ($2 * INTERVAL '1 minute')
       AND u.created_at <  now() - ($1 * INTERVAL '1 minute')
       AND NOT EXISTS (
         SELECT 1 FROM tickets t WHERE t.user_id = u.id AND t.status = 'paid'
       )
       AND NOT EXISTS (
         SELECT 1 FROM email_drip_sends d
         WHERE d.flow_key = $3 AND d.step = $4 AND d.dedup_id = u.id::text
       )
       AND NOT EXISTS (
         SELECT 1 FROM email_unsubscribes eu
         WHERE eu.email_normalized = lower(trim(u.email))
       )
     ORDER BY u.created_at ASC
     LIMIT 1000`,
    [opts.win.minAgo, opts.win.maxAgo, opts.flowKey, opts.stepId],
  );
  return toRecipients(rows);
}

/** Tamanho do lote por execução nos broadcasts sequenciais (warmup-friendly). */
function broadcastBatchSize(): number {
  const raw = Number.parseInt((process.env.EMAIL_BROADCAST_BATCH || "").trim(), 10);
  return Number.isFinite(raw) && raw >= 1 ? raw : 300;
}

/**
 * Broadcast sequencial para TODA a base: o passo N só vai para quem recebeu o
 * passo N-1 há pelo menos `gapMinutes`. Passo 1 vai para todos ainda não enviados.
 * LIMIT por execução controla o volume (rampa de aquecimento).
 */
async function listSequentialRecipients(opts: {
  flowKey: string;
  stepId: string;
  prevStepId: string | null;
  gapMinutes: number;
}): Promise<DripRecipient[]> {
  const pool = getPool();
  const batch = broadcastBatchSize();

  if (opts.prevStepId == null) {
    const { rows } = await pool.query<Row>(
      `SELECT u.id::text AS dedup_id, u.id AS user_id, u.email, u.name
       FROM users u
       WHERE u.email IS NOT NULL AND trim(u.email) <> ''
         AND NOT EXISTS (
           SELECT 1 FROM email_drip_sends d
           WHERE d.flow_key = $1 AND d.step = $2 AND d.dedup_id = u.id::text
         )
         AND NOT EXISTS (
           SELECT 1 FROM email_unsubscribes eu
           WHERE eu.email_normalized = lower(trim(u.email))
         )
       ORDER BY u.created_at ASC
       LIMIT $3`,
      [opts.flowKey, opts.stepId, batch],
    );
    return toRecipients(rows);
  }

  const { rows } = await pool.query<Row>(
    `SELECT u.id::text AS dedup_id, u.id AS user_id, u.email, u.name
     FROM email_drip_sends prev
     JOIN users u ON u.id = prev.user_id
     WHERE prev.flow_key = $1 AND prev.step = $2
       AND prev.sent_at <= now() - ($3 * INTERVAL '1 minute')
       AND u.email IS NOT NULL AND trim(u.email) <> ''
       AND NOT EXISTS (
         SELECT 1 FROM email_drip_sends d
         WHERE d.flow_key = $1 AND d.step = $4 AND d.dedup_id = u.id::text
       )
       AND NOT EXISTS (
         SELECT 1 FROM email_unsubscribes eu
         WHERE eu.email_normalized = lower(trim(u.email))
       )
     ORDER BY prev.sent_at ASC
     LIMIT $5`,
    [opts.flowKey, opts.prevStepId, opts.gapMinutes, opts.stepId, batch],
  );
  return toRecipients(rows);
}

// ────────────────────────────────────────────────
// FLUXO 01 — Pós-compra: upsell de múltiplas cotas (só quem tem < 8 cotas)
// ────────────────────────────────────────────────
const FLOW_UPSELL: DripFlow = {
  flowKey: "pos_compra_upsell",
  category: EMAIL_TAG_POS_COMPRA_UPSELL,
  steps: [
    { id: "upsell_1", advisoryLock: 7_203_300, build: POS_COMPRA_UPSELL_BUILDERS.upsell_1!,
      listRecipients: () => listBuyerRecipients({ flowKey: "pos_compra_upsell", stepId: "upsell_1", win: w(2 * H), maxCotas: 8 }) },
    { id: "upsell_2", advisoryLock: 7_203_301, build: POS_COMPRA_UPSELL_BUILDERS.upsell_2!,
      listRecipients: () => listBuyerRecipients({ flowKey: "pos_compra_upsell", stepId: "upsell_2", win: w(1 * D), maxCotas: 8 }) },
    { id: "upsell_3", advisoryLock: 7_203_302, build: POS_COMPRA_UPSELL_BUILDERS.upsell_3!,
      listRecipients: () => listBuyerRecipients({ flowKey: "pos_compra_upsell", stepId: "upsell_3", win: w(2 * D), maxCotas: 8 }) },
  ],
};

// ────────────────────────────────────────────────
// FLUXO EXTRA — Pós-compra: indique e ganhe (sequenciado após o upsell: 3d/4d/5d)
// ────────────────────────────────────────────────
const FLOW_INDIQUE: DripFlow = {
  flowKey: "comprou_indique",
  category: EMAIL_TAG_COMPROU_INDIQUE,
  steps: [
    { id: "indique_1", advisoryLock: 7_203_310, build: COMPROU_INDIQUE_BUILDERS.indique_1!,
      listRecipients: () => listBuyerRecipients({ flowKey: "comprou_indique", stepId: "indique_1", win: w(3 * D) }) },
    { id: "indique_2", advisoryLock: 7_203_311, build: COMPROU_INDIQUE_BUILDERS.indique_2!,
      listRecipients: () => listBuyerRecipients({ flowKey: "comprou_indique", stepId: "indique_2", win: w(4 * D) }) },
    { id: "indique_3", advisoryLock: 7_203_312, build: COMPROU_INDIQUE_BUILDERS.indique_3!,
      listRecipients: () => listBuyerRecipients({ flowKey: "comprou_indique", stepId: "indique_3", win: w(5 * D) }) },
  ],
};

// ────────────────────────────────────────────────
// FLUXO 02 — Prova social (cadastrado sem compra: 2h/24h/48h/72h)
// ────────────────────────────────────────────────
const FLOW_PROVA_SOCIAL: DripFlow = {
  flowKey: "prova_social",
  category: EMAIL_TAG_PROVA_SOCIAL,
  steps: [
    { id: "prova_1", advisoryLock: 7_203_320, build: PROVA_SOCIAL_BUILDERS.prova_1!,
      listRecipients: () => listNonBuyerRecipients({ flowKey: "prova_social", stepId: "prova_1", win: w(2 * H) }) },
    { id: "prova_2", advisoryLock: 7_203_321, build: PROVA_SOCIAL_BUILDERS.prova_2!,
      listRecipients: () => listNonBuyerRecipients({ flowKey: "prova_social", stepId: "prova_2", win: w(1 * D) }) },
    { id: "prova_3", advisoryLock: 7_203_322, build: PROVA_SOCIAL_BUILDERS.prova_3!,
      listRecipients: () => listNonBuyerRecipients({ flowKey: "prova_social", stepId: "prova_3", win: w(2 * D) }) },
    { id: "prova_4", advisoryLock: 7_203_323, build: PROVA_SOCIAL_BUILDERS.prova_4!,
      listRecipients: () => listNonBuyerRecipients({ flowKey: "prova_social", stepId: "prova_4", win: w(3 * D) }) },
  ],
};

// ────────────────────────────────────────────────
// FLUXO EXTRA — Recuperação de checkout (cadastrado sem compra, após prova social: 4d/5d/6d)
// ────────────────────────────────────────────────
const FLOW_CHECKOUT_RECOVERY: DripFlow = {
  flowKey: "checkout_recovery",
  category: EMAIL_TAG_CHECKOUT_RECOVERY,
  steps: [
    { id: "recovery_1", advisoryLock: 7_203_330, build: CHECKOUT_RECOVERY_BUILDERS.recovery_1!,
      listRecipients: () => listNonBuyerRecipients({ flowKey: "checkout_recovery", stepId: "recovery_1", win: w(4 * D) }) },
    { id: "recovery_2", advisoryLock: 7_203_331, build: CHECKOUT_RECOVERY_BUILDERS.recovery_2!,
      listRecipients: () => listNonBuyerRecipients({ flowKey: "checkout_recovery", stepId: "recovery_2", win: w(5 * D) }) },
    { id: "recovery_3", advisoryLock: 7_203_332, build: CHECKOUT_RECOVERY_BUILDERS.recovery_3!,
      listRecipients: () => listNonBuyerRecipients({ flowKey: "checkout_recovery", stepId: "recovery_3", win: w(6 * D) }) },
  ],
};

// ────────────────────────────────────────────────
// FLUXO OFERTA — Indique e ganhe para TODA a base (6 e-mails, broadcast sequencial 24h)
// ────────────────────────────────────────────────
const IND_GAP = 1 * D; // 24h entre os passos
const FLOW_INDIQUE_OFERTA: DripFlow = {
  flowKey: "indique_oferta",
  category: EMAIL_TAG_INDIQUE_OFERTA,
  steps: [
    { id: "indoffer_1", advisoryLock: 7_203_340, build: INDIQUE_OFERTA_BUILDERS.indoffer_1!,
      listRecipients: () => listSequentialRecipients({ flowKey: "indique_oferta", stepId: "indoffer_1", prevStepId: null, gapMinutes: 0 }) },
    { id: "indoffer_2", advisoryLock: 7_203_341, build: INDIQUE_OFERTA_BUILDERS.indoffer_2!,
      listRecipients: () => listSequentialRecipients({ flowKey: "indique_oferta", stepId: "indoffer_2", prevStepId: "indoffer_1", gapMinutes: IND_GAP }) },
    { id: "indoffer_3", advisoryLock: 7_203_342, build: INDIQUE_OFERTA_BUILDERS.indoffer_3!,
      listRecipients: () => listSequentialRecipients({ flowKey: "indique_oferta", stepId: "indoffer_3", prevStepId: "indoffer_2", gapMinutes: IND_GAP }) },
    { id: "indoffer_4", advisoryLock: 7_203_343, build: INDIQUE_OFERTA_BUILDERS.indoffer_4!,
      listRecipients: () => listSequentialRecipients({ flowKey: "indique_oferta", stepId: "indoffer_4", prevStepId: "indoffer_3", gapMinutes: IND_GAP }) },
    { id: "indoffer_5", advisoryLock: 7_203_344, build: INDIQUE_OFERTA_BUILDERS.indoffer_5!,
      listRecipients: () => listSequentialRecipients({ flowKey: "indique_oferta", stepId: "indoffer_5", prevStepId: "indoffer_4", gapMinutes: IND_GAP }) },
    { id: "indoffer_6", advisoryLock: 7_203_345, build: INDIQUE_OFERTA_BUILDERS.indoffer_6!,
      listRecipients: () => listSequentialRecipients({ flowKey: "indique_oferta", stepId: "indoffer_6", prevStepId: "indoffer_5", gapMinutes: IND_GAP }) },
  ],
};

export const CRM_FLOWS: DripFlow[] = [
  FLOW_UPSELL,
  FLOW_INDIQUE,
  FLOW_PROVA_SOCIAL,
  FLOW_CHECKOUT_RECOVERY,
  FLOW_INDIQUE_OFERTA,
];

/** Roda os 4 fluxos de CRM. Cada step tem advisory lock próprio. */
export async function runAllCrmFlows(opts?: {
  dryRun?: boolean;
}): Promise<RunDripFlowResult[]> {
  const results: RunDripFlowResult[] = [];
  for (const flow of CRM_FLOWS) {
    results.push(await runDripFlow(flow, { dryRun: Boolean(opts?.dryRun) }));
  }
  return results;
}
