/** Nome de arquivo gerado pelo servidor (UUID + extensão). Sem path traversal. */
export function isStoredAvatarUploadFilename(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const t = name.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(t);
}

export function avatarUploadPublicUrl(filename: string): string {
  return `/avataruploads/${encodeURIComponent(filename)}`;
}
