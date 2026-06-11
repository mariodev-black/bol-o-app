import type { UserWithdrawalHistoryItem } from "@/lib/referrals/withdrawHistory";

export function parseMoneyToCents(raw: string): number | null {
  const t = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function formatWithdrawDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function pixKeyTypeLabel(type: string): string {
  switch (type) {
    case "cpf":
      return "CPF";
    case "email":
      return "E-mail";
    case "phone":
      return "Telefone";
    case "random":
      return "Chave aleatória";
    default:
      return type.toUpperCase();
  }
}

export function balanceSourceLabel(source: UserWithdrawalHistoryItem["balanceSource"]): string {
  return source === "wallet" ? "Conta" : "Afiliado";
}

export type WithdrawStatusMeta = {
  label: string;
  className: string;
};

export function withdrawStatusMeta(status: string): WithdrawStatusMeta {
  switch (status) {
    case "pending":
      return {
        label: "Em análise",
        className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
      };
    case "processing":
      return {
        label: "PIX processando",
        className: "border-sky-400/30 bg-sky-400/10 text-sky-200",
      };
    case "paid":
    case "approved":
      return {
        label: "Pago",
        className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
      };
    case "failed":
      return {
        label: "Falhou",
        className: "border-orange-400/30 bg-orange-400/10 text-orange-200",
      };
    case "refunded":
      return {
        label: "Devolvido",
        className: "border-violet-400/30 bg-violet-400/10 text-violet-200",
      };
    case "rejected":
      return {
        label: "Recusado",
        className: "border-red-400/30 bg-red-400/10 text-red-300",
      };
    default:
      return {
        label: status,
        className: "border-white/15 bg-white/5 text-white/60",
      };
  }
}
