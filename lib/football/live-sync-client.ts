export const LIVE_PARTIDAS_POLL_MS = 60_000;

export function partidasUrlWithLiveSync(
  basePath: string,
  query: Record<string, string | number | boolean | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  params.set("liveSync", "1");
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : `${basePath}?liveSync=1`;
}
