import { getPool } from "@/lib/db";
import { sendWithdrawalPaidEmail } from "@/lib/email/withdrawal-paid";
import { sendPushToUserIds } from "@/lib/push/send";
import { formatBRLFromCents } from "@/lib/wallet/format";

export type WithdrawalNotifyInput = {
  withdrawalId: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  amountCents: number;
};

function withdrawalPaidKind(withdrawalId: string): string {
  return `withdrawal_paid:${withdrawalId}`;
}

function buildWithdrawalPaidCopy(amountCents: number): {
  title: string;
  preview: string;
  body: string;
} {
  const amountLabel = formatBRLFromCents(amountCents);
  return {
    title: "Saque concluído",
    preview: `Seu saque de ${amountLabel} foi enviado via PIX.`,
    body: `Seu saque de ${amountLabel} foi concluído com sucesso.

O valor foi enviado via PIX para a chave cadastrada na sua solicitação. Em alguns instantes o crédito deve aparecer na conta de destino.

Acompanhe o histórico em Saques no app.`,
  };
}

async function ensureWithdrawalNotification(input: WithdrawalNotifyInput): Promise<boolean> {
  const pool = getPool();
  const kind = withdrawalPaidKind(input.withdrawalId);
  const copy = buildWithdrawalPaidCopy(input.amountCents);
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO user_notifications (user_id, kind, title, preview, body)
     SELECT $1, $2, $3, $4, $5
     WHERE NOT EXISTS (
       SELECT 1 FROM user_notifications WHERE user_id = $1 AND kind = $2
     )
     RETURNING id::text`,
    [input.userId, kind, copy.title, copy.preview, copy.body],
  );
  return Boolean(inserted.rows[0]);
}

/** E-mail + sininho + push PWA quando o saque é concluído (idempotente por withdrawalId). */
export async function notifyWithdrawalPaid(input: WithdrawalNotifyInput): Promise<void> {
  const amountLabel = formatBRLFromCents(input.amountCents);
  const copy = buildWithdrawalPaidCopy(input.amountCents);

  const created = await ensureWithdrawalNotification(input);
  if (!created) return;

  try {
    await sendPushToUserIds({
      userIds: [input.userId],
      payload: {
        title: copy.title,
        body: copy.preview,
        url: "/saques",
        tag: withdrawalPaidKind(input.withdrawalId),
      },
    });
  } catch (err) {
    console.error("[withdraw-notify] push failed", { withdrawalId: input.withdrawalId, err });
  }

  try {
    await sendWithdrawalPaidEmail({
      userId: input.userId,
      email: input.userEmail,
      name: input.userName,
      amountLabel,
    });
  } catch (err) {
    console.error("[withdraw-notify] email failed", { withdrawalId: input.withdrawalId, err });
  }
}

/** Carrega dados do saque e dispara notificação (idempotente). */
export async function notifyWithdrawalPaidById(withdrawalId: string): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    amount_cents: number;
    user_email: string;
    user_name: string | null;
    status: string;
  }>(
    `SELECT w.id, w.user_id, w.amount_cents, w.status,
            u.email AS user_email, u.name AS user_name
     FROM affiliate_withdrawal_requests w
     JOIN users u ON u.id = w.user_id
     WHERE w.id = $1::uuid`,
    [withdrawalId],
  );
  const row = rows[0];
  if (!row || row.status !== "paid") return;

  await notifyWithdrawalPaid({
    withdrawalId: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
    amountCents: row.amount_cents,
  });
}
