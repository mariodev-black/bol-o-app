import { NextResponse } from "next/server";
import {
  buildUsersExportSpreadsheet,
  usersExportFilename,
} from "@/lib/admin/export-users-spreadsheet";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { listAdminUsers } from "@/lib/admin/users";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const users = await listAdminUsers();
    const body = buildUsersExportSpreadsheet(users);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${usersExportFilename()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[admin/users/export]", e);
    return NextResponse.json({ error: "Erro ao exportar usuários" }, { status: 500 });
  }
}
