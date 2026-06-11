import { getCartwaveAccessToken } from "@/lib/payments/cartwave/auth";
import {
  cartwaveApiBaseUrl,
  cartwaveCashoutPixSelfApprovePath,
  cartwaveHmacKey,
  cartwaveSourceAccountBranch,
  cartwaveSourceAccountNumber,
} from "@/lib/payments/cartwave/config";
import { buildCartwaveFailureMessage, readCartwaveHttpFailure } from "@/lib/payments/cartwave/errors";
import { cartwaveNormalizeJsonBody, cartwaveSignBody } from "@/lib/payments/cartwave/hmac";

export type CartwaveCashoutResult = {
  worked: boolean;
  transactionId: number | null;
  status: string | null;
  amount: number | null;
  raw: Record<string, unknown>;
};

export function pixKeyForCartwave(pixKeyType: string, pixKey: string): string {
  const key = pixKey.trim();
  if (pixKeyType === "phone") {
    const digits = key.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
    if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
    return key.startsWith("+") ? key : `+${digits}`;
  }
  if (pixKeyType === "email") return key.toLowerCase();
  return key;
}

export async function createCartwavePixCashoutSelfApprove(input: {
  amountCents: number;
  pixKeyType: string;
  pixKey: string;
  idempotencyKey: string;
  tag?: string;
}): Promise<CartwaveCashoutResult> {
  const amount = Math.round(input.amountCents) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor de saque invalido para Cartwave");
  }

  const body: Record<string, unknown> = {
    source_account_branch_identifier: cartwaveSourceAccountBranch(),
    source_account_number: cartwaveSourceAccountNumber(),
    amount,
    key: pixKeyForCartwave(input.pixKeyType, input.pixKey),
    tag: input.tag ?? `withdraw:${input.idempotencyKey}`,
  };

  const normalizedBody = cartwaveNormalizeJsonBody(body);
  const hmac = cartwaveSignBody(body, cartwaveHmacKey());
  const token = await getCartwaveAccessToken();
  const url = `${cartwaveApiBaseUrl()}${cartwaveCashoutPixSelfApprovePath()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      hmac,
      "idempotency-key": input.idempotencyKey,
      "User-Agent": "bol-o-app/cartwave-cashout",
    },
    body: normalizedBody,
  });

  const failure = await readCartwaveHttpFailure(res);
  const raw = failure.parsed ?? {};
  if (!res.ok) {
    throw new Error(buildCartwaveFailureMessage(failure, "Cartwave cashout"));
  }

  const worked = raw.worked === true;
  if (!worked) {
    const err =
      (typeof raw.erro_descriptor === "string" && raw.erro_descriptor) ||
      (typeof raw.new_erro_descriptor === "string" && raw.new_erro_descriptor) ||
      "Cartwave recusou o cashout";
    throw new Error(err);
  }

  const transactionId =
    typeof raw.transaction_id === "number"
      ? raw.transaction_id
      : typeof raw.id === "number"
        ? raw.id
        : null;

  return {
    worked,
    transactionId,
    status: typeof raw.status === "string" ? raw.status : null,
    amount: typeof raw.amount === "number" ? raw.amount : amount,
    raw,
  };
}
