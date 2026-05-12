/** Nome de arquivo gerado pelo servidor (UUID + extensão). Sem path traversal. */
export function isStoredAvatarUploadFilename(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const t = name.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(t);
}

export function mimeFromStoredAvatarFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * URL da foto customizada (rota autenticada + bytes no Postgres).
 * O parâmetro `v` muda a cada novo upload para quebrar cache do navegador.
 */
export function avatarUploadImageSrc(filename: string): string {
  return `/api/user/avatar-image?v=${encodeURIComponent(filename)}`;
}
