const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatAdminBRL(cents: number): string {
  return brl.format(cents / 100);
}

export function formatAdminBRLNullable(cents: number | null | undefined): string {
  if (cents == null) return "Não informado";
  return formatAdminBRL(cents);
}

export function formatAdminDate(value: string | Date | null | undefined): string {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export function formatAdminDateTime(value: string | Date | null | undefined): string {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function maskAdminCpf(cpf: string | null | undefined): string {
  const digits = (cpf ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return cpf?.trim() || "Não informado";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatAdminTicketType(type: string | null | undefined) {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized === "general") return "Principal";
  if (normalized === "daily") return "Diário";
  return type || "Não informado";
}

export function formatAdminCpaBps(cpaBps: number | null | undefined): string {
  return `${((cpaBps ?? 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}
