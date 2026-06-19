/** Erro esperado quando Next.js tenta SSG em rota que usa cookies/headers. */
export function isDynamicServerUsageError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { digest?: string; description?: string; message?: string };
  if (e.digest === "DYNAMIC_SERVER_USAGE") return true;
  const text = [e.description, e.message].filter(Boolean).join(" ");
  return text.includes("Dynamic server usage");
}
