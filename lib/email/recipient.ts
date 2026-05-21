/** Primeiro nome para saudação em e-mails. */
export function emailFirstName(fullName: string | null | undefined): string | null {
  const raw = fullName?.trim() ?? "";
  if (raw.length < 2) return null;
  const part = raw.split(/\s+/)[0];
  return part.length > 0 ? part : null;
}

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
