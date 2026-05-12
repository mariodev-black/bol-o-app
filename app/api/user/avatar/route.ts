import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { clampAvatarIndex } from "@/lib/auth/avatar-index";
import { clearUserAvatarUpload, updateUserAvatarIndex } from "@/lib/auth/users";
import { responseForDbError } from "@/lib/db-errors";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    avatarIndex: z.number().int().min(0).max(4).optional(),
    clearCustomAvatar: z.literal(true).optional(),
  })
  .superRefine((data, ctx) => {
    const clear = data.clearCustomAvatar === true;
    const preset = data.avatarIndex !== undefined;
    if (clear === preset) {
      ctx.addIssue({
        code: "custom",
        message: "Envie apenas avatarIndex (0 a 4) ou clearCustomAvatar: true.",
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
    const first = parsed.error.issues[0]?.message ?? "Corpo inválido";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  try {
    let user;
    if (parsed.data.clearCustomAvatar) {
      user = await clearUserAvatarUpload(userId);
    } else {
      const avatarIndex = clampAvatarIndex(parsed.data.avatarIndex!);
      user = await updateUserAvatarIndex(userId, avatarIndex);
    }
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (e: unknown) {
    const db = responseForDbError(e);
    if (db) {
      console.error("[user/avatar]", e);
      return NextResponse.json({ error: db.error }, { status: db.status });
    }
    console.error("[user/avatar]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
