export function formatAdminTicketType(type: string | null | undefined) {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized === "general") return "Principal";
  if (normalized === "daily") return "Diário";
  return type || "Não informado";
}
