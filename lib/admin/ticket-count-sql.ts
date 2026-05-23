/**
 * Critérios de contagem de cotas no admin (alinhado a `tickets` + promo grátis).
 * - Ativa: paga/aprovada no bolão (inclui brinde).
 * - Paga: valor > 0 (PIX); brinde tem total_amount_cents = 0.
 */

/** Cotas ativas (status pago no bolão, inclui grátis). */
export const SQL_TICKET_ACTIVE = `t.status IN ('paid', 'approved')`;

/** Cotas pagas de fato (exclui brinde / total zerado). */
export const SQL_TICKET_PAID = `${SQL_TICKET_ACTIVE} AND COALESCE(t.total_amount_cents, 0) > 0 AND NOT COALESCE(t.is_promo_bonus, false)`;

/** Mesmos critérios sem alias (subqueries em `FROM tickets`). */
export const SQL_TICKET_ACTIVE_BARE = `status IN ('paid', 'approved')`;
export const SQL_TICKET_PAID_BARE = `${SQL_TICKET_ACTIVE_BARE} AND COALESCE(total_amount_cents, 0) > 0 AND NOT COALESCE(is_promo_bonus, false)`;
export const SQL_TICKET_PROMO_BARE = `${SQL_TICKET_ACTIVE_BARE} AND (COALESCE(is_promo_bonus, false) OR COALESCE(total_amount_cents, 0) = 0)`;
