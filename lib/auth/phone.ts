/** Valida apenas dígitos nacionais (sem código do país). Brasil: 10 (fixo) ou 11 (celular com 9). */
export function isValidBrazilNationalDigits(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = parseInt(d.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return false;
  if (/^(\d)\1{9,10}$/.test(d)) return false;
  if (d.length === 11) {
    return d[2] === "9";
  }
  return d[2] !== "9";
}

/** Para outros países: comprimento típico após DDI no seletor (flexível). */
export function isReasonableNationalDigits(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15;
}

/** Celular brasileiro (10–11 dígitos nacionais) em E.164 (+55…). */
export function normalizeBrazilPhoneE164(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 10) return "";
  return d.startsWith("55") && d.length >= 12 ? `+${d}` : `+55${d}`;
}
