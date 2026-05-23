import type { AdminUserListItem } from "@/lib/admin/users";

function escapeCsvCell(value: string): string {
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
}

/** CSV com BOM e `;` — abre corretamente no Excel (pt-BR). */
export function buildUsersExportSpreadsheet(users: AdminUserListItem[]): string {
  const header = ["Nome", "E-mail", "Telefone"].map(escapeCsvCell).join(";");
  const rows = users.map((user) =>
    [
      user.name?.trim() || "Sem nome",
      user.email.trim(),
      user.phone?.trim() || "",
    ]
      .map(escapeCsvCell)
      .join(";"),
  );
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}

export function usersExportFilename(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  return `usuarios-bolao-${iso}.csv`;
}
