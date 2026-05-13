import { startInternalCronScheduler } from "@/lib/cron/bootstrap";

/**
 * Garante o cron interno no processo Node (PM2 + `next start`), onde `instrumentation.ts`
 * pode rodar tarde ou só após a primeira requisição.
 */
export function InternalCronBootstrap() {
  startInternalCronScheduler();
  return null;
}
