export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startInternalCronScheduler } = await import("@/lib/cron/bootstrap");
  startInternalCronScheduler();
}
