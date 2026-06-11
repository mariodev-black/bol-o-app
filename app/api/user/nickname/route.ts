import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { findUserById, updateUserNickname } from "@/lib/auth/users";
import { sanitizeNickname } from "@/lib/user/nickname";
import { responseForDbError } from "@/lib/db-errors";

export const runtime = "nodejs";

/** Define/atualiza o apelido público exibido no ranking. */
export async function PUT(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  let userId: string;
  try {
    userId = (await verifySessionToken(token)) ?? "";
  } catch {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const raw = (json as { nickname?: unknown })?.nickname;
  const result = sanitizeNickname(raw);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const updated = await updateUserNickname(userId, result.value);
    if (!updated) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    const user = await findUserById(userId);
    return NextResponse.json({ ok: true as const, nickname: result.value, user });
  } catch (e: unknown) {
    const db = responseForDbError(e);
    if (db) {
      console.error("[user/nickname]", e);
      return NextResponse.json({ error: db.error }, { status: db.status });
    }
    console.error("[user/nickname]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
