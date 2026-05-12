import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { isStoredAvatarUploadFilename } from "@/lib/user/avatar-filename";

const MAX_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export function avatarUploadDir(): string {
  return join(process.cwd(), "public", "avataruploads");
}

export function ensureAvatarUploadDir(): void {
  const dir = avatarUploadDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function saveUserAvatarBuffer(buf: Buffer, mimeRaw: string): string {
  const mime = mimeRaw.split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = MIME_TO_EXT.get(mime);
  if (!ext) {
    throw new Error("unsupported_mime");
  }
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    throw new Error("invalid_size");
  }
  ensureAvatarUploadDir();
  const name = `${randomUUID()}${ext}`;
  const full = join(avatarUploadDir(), name);
  writeFileSync(full, buf);
  return name;
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
