import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { appendBolaoDefinitionAuditLog } from "@/lib/boloes/definitions/audit-log";
import {
  createBolaoDefinition,
  listBolaoDefinitions,
} from "@/lib/boloes/definitions/repository";
import { listBolaoDefinitionsWithStats } from "@/lib/boloes/definitions/stats";
import type { BolaoDefinitionInput } from "@/lib/boloes/definitions/types";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const withStats = url.searchParams.get("stats") === "1";
    const items = withStats
      ? await listBolaoDefinitionsWithStats({ includeDisabled: true })
      : await listBolaoDefinitions({ includeDisabled: true });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[admin/boloes/definitions] GET", error);
    return NextResponse.json({ error: "Falha ao listar bolões" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as BolaoDefinitionInput;
    const created = await createBolaoDefinition(body);
    await appendBolaoDefinitionAuditLog({
      bolaoDefinitionId: created.id,
      action: "created",
      actorUserId: auth.admin.id,
      actorEmail: auth.admin.email,
      payload: { displayName: created.displayName, slug: created.slug },
    });
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar bolão";
    console.error("[admin/boloes/definitions] POST", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
