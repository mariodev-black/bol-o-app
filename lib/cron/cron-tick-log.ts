/**
 * Logs estruturados do ciclo de manutenção / cron.
 * Cada linha: `[cron-tick] {"t":"ISO","phase":"...",...}` — fácil de grep em Vercel/Datadog.
 */
export function cronTickLog(phase: string, fields: Record<string, unknown> = {}): void {
  const payload = { t: new Date().toISOString(), phase, ...fields };
  try {
    console.info(`[cron-tick] ${JSON.stringify(payload)}`);
  } catch {
    console.info("[cron-tick]", phase, fields);
  }
}
