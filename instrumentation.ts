export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDatabasePoolReady } = await import("@/lib/db");
  const { startInternalCronScheduler } = await import("@/lib/cron/bootstrap");

  try {
    await ensureDatabasePoolReady();
  } catch (error) {
    console.error("[db] pool warm-up failed on boot", error);
  }

  startInternalCronScheduler();
}
