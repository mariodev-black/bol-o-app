import { formatCpfDisplay, isValidCpf, normalizeCpf } from "@/lib/auth/cpf";

export function isValidEmailLoose(v: string): boolean {
  const t = v.trim();
  if (t.length < 5) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/** E-mail se tiver @ ou qualquer letra; caso contrário trata como CPF. */
export function loginInputLooksLikeEmail(value: string): boolean {
  const t = value.trim();
  if (t.includes("@")) return true;
  return /[a-zA-Z]/.test(t);
}

export function formatLoginIdentifierInput(raw: string): string {
  if (loginInputLooksLikeEmail(raw)) return raw.replace(/^\s+/, "");
  return formatCpfDisplay(raw);
}

export function resolveLoginIdentifier(value: string): string {
  if (loginInputLooksLikeEmail(value)) return value.trim().toLowerCase();
  return normalizeCpf(value);
}

export function isLoginIdentifierReady(value: string): boolean {
  if (loginInputLooksLikeEmail(value)) return isValidEmailLoose(value);
  const digits = normalizeCpf(value);
  return digits.length === 11 && isValidCpf(digits);
}

export function getLoginIdentifierPlaceholder(value: string): string {
  if (!value.trim()) return "seu@email.com ou 000.000.000-00";
  if (loginInputLooksLikeEmail(value)) return "seu@email.com";
  return "000.000.000-00";
}

export function getLoginIdentifierHint(value: string): string | null {
  const t = value.trim();
  if (!t) return "Use o e-mail ou os 11 números do CPF cadastrados.";
  if (loginInputLooksLikeEmail(t)) {
    if (isValidEmailLoose(t)) return null;
    if (!t.includes("@")) return "Inclua o @ no endereço de e-mail.";
    return "Verifique se o e-mail está completo.";
  }
  const digits = normalizeCpf(t);
  if (digits.length < 11) return `CPF: ${digits.length} de 11 dígitos.`;
  if (!isValidCpf(digits)) return "CPF inválido. Confira os números.";
  return null;
}
