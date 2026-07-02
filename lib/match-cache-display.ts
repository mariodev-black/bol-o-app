import type { CachedMatchRow } from "@/lib/matches-cache";
import { pickScoreFromPartidaPayload } from "@/lib/partida-placar";
import {
  isFinishedMatchStatus,
  isLiveOrInProgressMatchStatus,
  resolveOfficialMatchResults,
} from "@/lib/palpites-match-open";

export function isFinishedCacheStatus(status: string): boolean {
  return isFinishedMatchStatus(status);
}

export function isLiveProviderStatus(status: string): boolean {
  return isLiveOrInProgressMatchStatus(status);
}

/** Status efetivo: coluna cache + correção via provider_payload quando stale. */
export function resolveMatchStatusFromCacheRow(row: {
  status: string;
  provider_payload?: Record<string, unknown> | null;
}): string {
  const cacheStatus = String(row.status ?? "").trim();
  const payloadStatus = String(
    (row.provider_payload as Record<string, unknown> | null | undefined)?.status ?? "",
  ).trim();
  if (isFinishedCacheStatus(cacheStatus) && isLiveProviderStatus(payloadStatus)) {
    return payloadStatus;
  }
  return cacheStatus || payloadStatus || "agendado";
}

/** Placar oficial para UI/ranking — prioriza payload da API quando mais fresco. */
export function resolveMatchScoresFromCacheRow(row: CachedMatchRow): {
  resultCasa: number | null;
  resultVisitante: number | null;
} {
  const status = resolveMatchStatusFromCacheRow(row);
  const payload = row.provider_payload as Record<string, unknown> | null | undefined;
  const kickoffAt = row.kickoff_at;

  if (payload && typeof payload === "object") {
    const merged = { ...payload, status };
    const fromPayload = {
      resultCasa: pickScoreFromPartidaPayload(merged, "casa"),
      resultVisitante: pickScoreFromPartidaPayload(merged, "visitante"),
    };
    if (fromPayload.resultCasa != null && fromPayload.resultVisitante != null) {
      return fromPayload;
    }
  }

  return resolveOfficialMatchResults({
    status,
    kickoffAt,
    resultCasa: row.result_casa,
    resultVisitante: row.result_visitante,
  });
}
