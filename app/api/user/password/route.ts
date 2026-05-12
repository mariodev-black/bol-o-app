import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getUserPasswordHashById, updateUserPasswordHash } from "@/lib/auth/users";
import { responseForDbError } from "@/lib/db-errors";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres").max(200),
    confirmNewPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({
        code: "custom",
        message: "A confirmação não coincide com a nova senha.",
        path: ["confirmNewPassword"],
      });
    }
    if (data.newPassword === data.currentPassword) {
      ctx.addIssue({
        code: "custom",
        message: "A nova senha deve ser diferente da senha atual.",
        path: ["newPassword"],
      });
    }
  });

export async function PATCH(request: NextRequest) {
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Dados inválidos";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const row = await getUserPasswordHashById(userId);
    if (!row) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    if (row.password_hash == null || row.password_hash === "") {
      return NextResponse.json(
        {
          error:
            "Esta conta não tem senha cadastrada (ex.: login só com Google). Use “Esqueceu a senha?” no login para criar uma senha pelo e-mail.",
        },
        { status: 400 }
      );
    }

    const ok = await verifyPassword(currentPassword, row.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Senha atual incorreta." }, { status: 401 });
    }

    const passwordHash = await hashPassword(newPassword);
    const updated = await updateUserPasswordHash(userId, passwordHash);
    if (!updated) {
      return NextResponse.json({ error: "Não foi possível atualizar a senha." }, { status: 500 });
    }

    return NextResponse.json({ ok: true as const });
  } catch (e: unknown) {
    const db = responseForDbError(e);
    if (db) {
      console.error("[user/password]", e);
      return NextResponse.json({ error: db.error }, { status: db.status });
    }
    console.error("[user/password]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
