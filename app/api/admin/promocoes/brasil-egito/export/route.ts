import { NextRequest, NextResponse } from "next/server";
import { getAdminBrasilEgitoPromoDashboard } from "@/lib/admin/brasil-egito-placar-promo";
import {
  buildPlacarPromoExportSpreadsheet,
  placarPromoExportFilename,
} from "@/lib/admin/export-placar-promo-spreadsheet";
import { requireAdminApi } from "@/lib/admin/require-admin-api";

export const runtime = "nodejs";

type PrizeFilter =
  | "all"
  | "exact_hit"
  | "missed"
  | "free_ticket"
  | "shirt";

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parsePrizeFilter(raw: string | null): PrizeFilter {
  switch (raw) {
    case "exact_hit":
    case "missed":
    case "free_ticket":
    case "shirt":
      return raw;
    default:
      return "all";
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const dashboard = await getAdminBrasilEgitoPromoDashboard();
    const query = normalize(request.nextUrl.searchParams.get("q"));
    const prizeFilter = parsePrizeFilter(
      request.nextUrl.searchParams.get("filter"),
    );

    const rows = dashboard.rows.filter((row) => {
      if (query) {
        const haystack = `${normalize(row.userName)} ${normalize(row.userEmail)}`;
        if (!haystack.includes(query)) return false;
      }
      switch (prizeFilter) {
        case "exact_hit":
          return row.scoreExactHit === true;
        case "missed":
          return row.scoreExactHit === false;
        case "free_ticket":
          return row.freeTicketPrizeEligible;
        case "shirt":
          return row.shirtPrizeEligible;
        default:
          return true;
      }
    });

    const body = buildPlacarPromoExportSpreadsheet(rows);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${placarPromoExportFilename("brasil-egito")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[admin/promocoes/brasil-egito/export]", e);
    return NextResponse.json(
      { error: "Erro ao exportar promoção" },
      { status: 500 },
    );
  }
}
