import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Teto por solicitação (centavos). Evita valores absurdos e overflow int4 no PG. */
export function maxWithdrawalCentsPerRequest(): number {
  return intEnv("WITHDRAWAL_MAX_AMOUNT_CENTS", 50_000_000); // R$ 500.000,00 default
}

export function isUuidString(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function assertValidWithdrawalUserId(userId: string): void {
  const t = userId.trim();
  if (!isUuidString(t)) throw new Error("Sessao invalida");
}

function cpfDigitsValid(d11: string): boolean {
  if (d11.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d11)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number.parseInt(d11[i]!, 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number.parseInt(d11[9]!, 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number.parseInt(d11[i]!, 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number.parseInt(d11[10]!, 10);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normaliza chave para persistência (trim); CPF/telefone só dígitos. */
export function normalizePixKey(
  pixKeyType: "cpf" | "email" | "phone" | "random",
  pixKey: string
): string {
  const t = pixKey.trim();
  if (pixKeyType === "cpf" || pixKeyType === "phone") return t.replace(/\D/g, "");
  return t;
}

export function assertValidPixWithdrawal(
  pixKeyType: "cpf" | "email" | "phone" | "random",
  rawPixKey: string
): string {
  const key = normalizePixKey(pixKeyType, rawPixKey);
  if (key.length < 3 || key.length > 200) throw new Error("Chave PIX invalida");

  if (pixKeyType === "cpf") {
    if (key.length !== 11) throw new Error("CPF da chave PIX deve ter 11 digitos");
    if (!cpfDigitsValid(key)) throw new Error("CPF da chave PIX invalido");
    return key;
  }
  if (pixKeyType === "email") {
    const lower = key.toLowerCase();
    if (!EMAIL_RE.test(lower) || lower.length > 200) throw new Error("E-mail da chave PIX invalido");
    return lower;
  }
  if (pixKeyType === "phone") {
    if (key.length < 10 || key.length > 13) throw new Error("Telefone da chave PIX invalido");
    return key;
  }
  // random (EVP): típico UUID 32 hex ou com hífens
  if (key.length < 10 || key.length > 77) throw new Error("Chave aleatoria PIX invalida");
  return key;
}

export function assertWithdrawalAmountBounds(amountCents: number, minCents: number): void {
  if (!Number.isInteger(amountCents)) throw new Error("Valor deve ser em centavos inteiros");
  if (amountCents <= 0) throw new Error("Valor invalido");
  if (amountCents < minCents) {
    throw new Error(`Valor minimo para saque: R$ ${(minCents / 100).toFixed(2).replace(".", ",")}`);
  }
  const maxC = maxWithdrawalCentsPerRequest();
  if (amountCents > maxC) {
    throw new Error(`Valor maximo por solicitacao: R$ ${(maxC / 100).toFixed(2).replace(".", ",")}`);
  }
}

export function assertBalanceCoversWithdrawal(
  balanceSource: WithdrawalBalanceSource,
  balanceCents: number,
  affiliateBalanceCents: number,
  amountCents: number
): void {
  const available = balanceSource === "wallet" ? balanceCents : affiliateBalanceCents;
  if (available < amountCents) {
    throw new Error("Saldo insuficiente para este valor");
  }
}
