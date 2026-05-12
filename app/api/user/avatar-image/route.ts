import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { isStoredAvatarUploadFilename, mimeFromStoredAvatarFilename } from "@/lib/user/avatar-filename";
import { readAvatarUploadFromDisk } from "@/lib/user/avatar-upload-storage";

export const runtime = "nodejs";

/**
 * Foto customizada do usuário logado. Em produção serverless os bytes vêm do Postgres;
 * em dev legado pode cair no arquivo em public/avataruploads/.
 * Query `v` só invalida cache do navegador (valor ignorado na autorização).
 */
export async function GET(_request: NextRequest) {
  const token = _request.cookies.get(sessionCookieName())?.value;
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

  const pool = getPool();
  const { rows } = await pool.query<{ d: Buffer | null; f: string | null }>(
    `SELECT avatar_upload_data AS d, avatar_upload_filename AS f FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  if (!row?.f || !isStoredAvatarUploadFilename(row.f)) {
    return NextResponse.json({ error: "Sem foto" }, { status: 404 });
  }

  let buf: Buffer | null = null;
  if (row.d && Buffer.isBuffer(row.d) && row.d.length > 0) {
    buf = row.d;
  } else {
    buf = readAvatarUploadFromDisk(row.f);
  }

  if (!buf?.length) {
    return NextResponse.json({ error: "Sem foto" }, { status: 404 });
  }

  const mime = mimeFromStoredAvatarFilename(row.f);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, no-cache, must-revalidate",
    },
  });
}
