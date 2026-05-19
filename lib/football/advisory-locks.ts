/**
 * Locks consultivos Postgres (`pg_try_advisory_lock`) para evitar que **vários
 * processos Node** (PM2 cluster, réplicas, scheduler + cron HTTP) disparem a
 * mesma carga na API Futebol em paralelo.
 *
 * Chaves numéricas fixas — não colidir com `lib/prizes/processor.ts` (7202602).
 */

import { getPool } from "@/lib/db";

/** Full sync (`syncAllConfigured`): snapshot + partidas hierárquicas + extras. */
export const ADVISORY_LOCK_FOOTBALL_FULL_SYNC = 7_202_610;

/** Um tick do worker realtime (`GET /partidas/:id` em lote). */
export const ADVISORY_LOCK_FOOTBALL_REALTIME_TICK = 7_202_611;

function advisoryLocksDisabled(): boolean {
  const raw = (process.env.FOOTBALL_ADVISORY_LOCKS_DISABLED || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * Executa `fn` segurando o lock; se outra sessão já segura, retorna `null` sem
 * chamar `fn`. Libera o lock na mesma conexão antes de `release()`.
 */
export async function tryWithFootballAdvisoryLock<T>(key: number, fn: () => Promise<T>): Promise<T | null> {
  if (advisoryLocksDisabled()) {
    return fn();
  }
  const pool = getPool();
  const client = await pool.connect();
  let locked = false;
  try {
    const { rows } = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [key]);
    locked = Boolean(rows[0]?.locked);
    if (!locked) return null;
    return await fn();
  } finally {
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [key]);
      } catch {
        /* ignore */
      }
    }
    client.release();
  }
}
