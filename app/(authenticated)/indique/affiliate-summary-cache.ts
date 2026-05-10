import type { AffiliateSummary } from "./affiliate-types";

const AFFILIATE_SUMMARY_CACHE_MS = 60 * 1000;

let affiliateSummaryCache: { at: number; summary: AffiliateSummary | null } | null = null;

export async function fetchAffiliateSummaryCached(options?: { force?: boolean }): Promise<AffiliateSummary | null> {
  if (
    !options?.force &&
    affiliateSummaryCache &&
    Date.now() - affiliateSummaryCache.at < AFFILIATE_SUMMARY_CACHE_MS
  ) {
    return affiliateSummaryCache.summary;
  }

  const response = await fetch("/api/affiliate/summary", {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as { summary?: AffiliateSummary };
  const summary = response.ok && data.summary ? data.summary : null;
  affiliateSummaryCache = { at: Date.now(), summary };
  return summary;
}

export function invalidateAffiliateSummaryCache() {
  affiliateSummaryCache = null;
}
