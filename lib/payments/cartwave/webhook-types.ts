/** Eventos Cash Out da Cartwave — https://cartwave-prod.readme.io/reference/events */

export const CARTWAVE_CASHOUT_EVENT_TYPES = [
  "PIX_CASHOUT_CREATED",
  "PIX_CASHOUT_SUCCESS",
  "PIX_CASHOUT_ERROR",
  "PIX_CASHOUT_CANCELED",
  "PIX_CASHOUT_REFUND",
] as const;

export type CartwaveCashoutEventType = (typeof CARTWAVE_CASHOUT_EVENT_TYPES)[number];

export type CartwaveWebhookPayload = {
  type?: string;
  data?: Record<string, unknown>;
};

export type CartwaveCashoutEventData = {
  worked?: boolean;
  transaction_id?: number;
  end_to_end?: string | null;
  origin_end_to_end?: string | null;
  origin_transaction_id?: number;
  status?: string;
  amount?: number;
  payment_date?: string;
  fee?: number;
  key?: string | null;
  tag?: string | null;
  from_accout?: string;
  error?: string;
  cancel_description?: string;
  recipient_name?: string | null;
};

export function isCartwaveCashoutEventType(type: string): type is CartwaveCashoutEventType {
  return (CARTWAVE_CASHOUT_EVENT_TYPES as readonly string[]).includes(type);
}

export function parseWithdrawalIdFromCartwaveTag(tag: unknown): string | null {
  if (typeof tag !== "string") return null;
  const t = tag.trim();
  const prefixes = ["bolao-withdraw:", "withdraw:"];
  for (const prefix of prefixes) {
    if (t.startsWith(prefix)) {
      const id = t.slice(prefix.length).trim();
      if (/^[0-9a-f-]{36}$/i.test(id)) return id;
    }
  }
  return null;
}
