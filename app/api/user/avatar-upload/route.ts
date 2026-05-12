import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { setUserAvatarUploadFilename } from "@/lib/auth/users";
import { responseForDbError } from "@/lib/db-errors";
import { deleteUserAvatarFile, saveUserAvatarBuffer, AVATAR_UPLOAD_MAX_BYTES } from "@/lib/user/avatar-upload-storage";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário inválido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Envie o arquivo no campo file" }, { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o arquivo" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";

  let newName: string;
  try {
    newName = saveUserAvatarBuffer(buf, mime);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "unsupported_mime") {
      return NextResponse.json(
        { error: "Formato não aceito. Use JPG, PNG ou WebP." },
        { status: 400 }
      );
    }
    if (msg === "invalid_size") {
      return NextResponse.json(
        { error: `Imagem muito grande após envio (máx. ${Math.round(AVATAR_UPLOAD_MAX_BYTES / (1024 * 1024))} MB).` },
        { status: 400 }
      );
    }
    console.error("[user/avatar-upload] save", e);
    return NextResponse.json({ error: "Não foi possível salvar a imagem" }, { status: 400 });
  }

  try {
    const user = await setUserAvatarUploadFilename(userId, newName);
    if (!user) {
      deleteUserAvatarFile(newName);
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (e: unknown) {
    deleteUserAvatarFile(newName);
    const db = responseForDbError(e);
    if (db) {
      console.error("[user/avatar-upload]", e);
      return NextResponse.json({ error: db.error }, { status: db.status });
    }
    console.error("[user/avatar-upload]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
