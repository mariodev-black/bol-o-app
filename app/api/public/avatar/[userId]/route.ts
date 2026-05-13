import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { isStoredAvatarUploadFilename, mimeFromStoredAvatarFilename } from "@/lib/user/avatar-filename";
import { readAvatarUploadFromDisk } from "@/lib/user/avatar-upload-storage";

export const runtime = "nodejs";

/** Avatar customizado público (ranking). Presets continuam em assets no cliente. */
export async function GET(_request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const pool = getPool();
  const { rows } = await pool.query<{ d: Buffer | null; f: string | null }>(
    `SELECT avatar_upload_data AS d, avatar_upload_filename AS f FROM users WHERE id::text = $1 LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row?.f || !isStoredAvatarUploadFilename(row.f)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let buf: Buffer | null = null;
  if (row.d && Buffer.isBuffer(row.d) && row.d.length > 0) {
    buf = row.d;
  } else {
    buf = readAvatarUploadFromDisk(row.f);
  }
  if (!buf?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mime = mimeFromStoredAvatarFilename(row.f);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
