import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/require-admin-api";
import { appendBolaoDefinitionAuditLog } from "@/lib/boloes/definitions/audit-log";
import {
  deleteBolaoDefinition,
  getBolaoDefinitionById,
  updateBolaoDefinition,
} from "@/lib/boloes/definitions/repository";
import type { BolaoDefinitionInput } from "@/lib/boloes/definitions/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const item = await getBolaoDefinitionById(id);
    if (!item) return NextResponse.json({ error: "Bolão não encontrado" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("[admin/boloes/definitions/[id]] GET", error);
    return NextResponse.json({ error: "Falha ao carregar bolão" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const body = (await request.json()) as BolaoDefinitionInput;
    const updated = await updateBolaoDefinition(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Bolão não encontrado" }, { status: 404 });
    }
    await appendBolaoDefinitionAuditLog({
      bolaoDefinitionId: id,
      action: "updated",
      actorUserId: auth.admin.id,
      actorEmail: auth.admin.email,
      payload: { displayName: updated.displayName },
    });
    return NextResponse.json({ item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar bolão";
    console.error("[admin/boloes/definitions/[id]] PUT", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  try {
    const ok = await deleteBolaoDefinition(id);
    if (!ok) return NextResponse.json({ error: "Bolão não encontrado" }, { status: 404 });
    await appendBolaoDefinitionAuditLog({
      bolaoDefinitionId: id,
      action: "disabled",
      actorUserId: auth.admin.id,
      actorEmail: auth.admin.email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/boloes/definitions/[id]] DELETE", error);
    return NextResponse.json({ error: "Falha ao desativar bolão" }, { status: 500 });
  }
}
