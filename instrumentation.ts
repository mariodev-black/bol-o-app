export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDatabasePoolReady } = await import("@/lib/db");

  try {
    await ensureDatabasePoolReady();
  } catch (error) {
    console.error("[db] pool warm-up failed on boot", error);
  }

  const { startSchedulerV2 } = await import("@/lib/football/scheduler-v2");
  startSchedulerV2();
}
