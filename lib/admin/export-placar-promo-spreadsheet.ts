import { formatAdminDate } from "@/lib/admin/format";

export type PlacarPromoExportRow = {
  userName: string | null;
  userEmail: string;
  predCasa: number;
  predVisitante: number;
  scoreExactHit: boolean | null;
  friendsInvited: number;
  friendsGoal: number;
  freeTicketPrizeEligible: boolean;
  shirtPrizeEligible: boolean;
  submittedAt: string;
};

function escapeCsvCell(value: string): string {
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
}

function hitLabel(hit: boolean | null): string {
  if (hit == null) return "Aguardando";
  return hit ? "Acertou" : "Errou";
}

function yesNo(value: boolean): string {
  return value ? "Sim" : "Não";
}

/** CSV com BOM e `;` — abre corretamente no Excel (pt-BR). */
export function buildPlacarPromoExportSpreadsheet(
  rows: PlacarPromoExportRow[],
): string {
  const header = [
    "Nome",
    "E-mail",
    "Palpite",
    "Placar",
    "Indicações",
    "Meta indicações",
    "Cota grátis",
    "Camisa",
    "Enviado em",
  ]
    .map(escapeCsvCell)
    .join(";");

  const body = rows.map((row) =>
    [
      row.userName?.trim() || "Sem nome",
      row.userEmail.trim(),
      `${row.predCasa} x ${row.predVisitante}`,
      hitLabel(row.scoreExactHit),
      String(row.friendsInvited),
      String(row.friendsGoal),
      yesNo(row.freeTicketPrizeEligible),
      yesNo(row.shirtPrizeEligible),
      formatAdminDate(row.submittedAt),
    ]
      .map(escapeCsvCell)
      .join(";"),
  );

  return `\uFEFF${[header, ...body].join("\r\n")}`;
}

export function placarPromoExportFilename(
  slug: string,
  date = new Date(),
): string {
  const iso = date.toISOString().slice(0, 10);
  return `promo-${slug}-${iso}.csv`;
}
