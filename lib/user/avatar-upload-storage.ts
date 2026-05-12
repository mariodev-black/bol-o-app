import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { isStoredAvatarUploadFilename } from "@/lib/user/avatar-filename";

/** Limite do arquivo (bytes no DB ou em disco). */
export const AVATAR_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

const MIME_TO_EXT = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export function avatarUploadDir(): string {
  return join(process.cwd(), "public", "avataruploads");
}

export function assertAvatarUploadBuffer(buf: Buffer, mimeRaw: string): { mime: string; ext: string } {
  const mime = mimeRaw.split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = MIME_TO_EXT.get(mime);
  if (!ext) {
    throw new Error("unsupported_mime");
  }
  if (buf.length === 0 || buf.length > AVATAR_UPLOAD_MAX_BYTES) {
    throw new Error("invalid_size");
  }
  return { mime, ext };
}

export function newRandomAvatarFilename(ext: string): string {
  return `${randomUUID()}${ext}`;
}

export function readAvatarUploadFromDisk(filename: string): Buffer | null {
  if (!isStoredAvatarUploadFilename(filename)) return null;
  const full = join(avatarUploadDir(), filename);
  if (!existsSync(full)) return null;
  try {
    return readFileSync(full);
  } catch {
    return null;
  }
}

export function deleteUserAvatarFile(filename: string | null | undefined): void {
  if (!filename || !isStoredAvatarUploadFilename(filename)) return;
  const full = join(avatarUploadDir(), filename);
  try {
    if (existsSync(full)) unlinkSync(full);
  } catch {
    /* ignore */
  }
}
