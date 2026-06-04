/** Mensagem para exibir abaixo do campo (null = sem erro). */
export function getBrazilPhoneValidationMessage(digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (!d.length) return null;
  if (d.length < 10) {
    return `Informe o DDD e o número completo (${d.length} de 10 ou 11 dígitos).`;
  }
  if (d.length > 11) return "Número muito longo.";
  const ddd = parseInt(d.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return "DDD inválido.";
  if (/^(\d)\1{9,10}$/.test(d)) return "Número inválido.";
  if (d.length === 11 && d[2] !== "9") {
    return "Celular deve começar com 9 após o DDD.";
  }
  if (d.length === 10 && d[2] === "9") {
    return "Use 11 dígitos para celular (com o 9 na frente).";
  }
  return isValidBrazilNationalDigits(d) ? null : "Número inválido.";
}

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
