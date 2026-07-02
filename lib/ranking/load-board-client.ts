import type { PredictionBolaoType } from "@/lib/predictions";
import {
  emptyRankingBoardMeta,
  type RankingBoardMeta,
  type RankingBoardRow,
} from "@/lib/ranking/board-types";

export function rankingBoardApiUrl(
  bolaoType: PredictionBolaoType,
  ticketId: string | null,
  options?: { definitionId?: string | null },
): string | null {
  const definitionId = options?.definitionId?.trim();
  if (definitionId) {
    return `/api/ranking/board?mode=dynamic&definitionId=${encodeURIComponent(definitionId)}`;
  }
  if (bolaoType === "principal") return "/api/ranking/board?mode=principal";
  if (!ticketId) return null;
  if (bolaoType === "extra") {
    return `/api/ranking/board?mode=extra&ticketId=${encodeURIComponent(ticketId)}`;
  }
  if (bolaoType === "diario") {
    return `/api/ranking/board?mode=diario&ticketId=${encodeURIComponent(ticketId)}`;
  }
  return null;
}

export type RankingBoardLoadResult = {
  rows: RankingBoardRow[];
  meta: RankingBoardMeta | null;
  error: string | null;
};

export async function fetchRankingBoardClient(
  bolaoType: PredictionBolaoType,
  ticketId: string | null,
  options?: { definitionId?: string | null },
): Promise<RankingBoardLoadResult> {
  const url = rankingBoardApiUrl(bolaoType, ticketId, options);
  if (!url) {
    return {
      rows: [],
      meta: null,
      error: "Selecione uma cota para ver o ranking.",
    };
  }

  try {
    const boardResp = await fetch(url, {
      credentials: "include",
      cache: "no-store",
    });
    const boardData = (await boardResp.json().catch(() => ({}))) as {
      rows?: RankingBoardRow[];
      meta?: RankingBoardMeta;
      error?: string;
    };

    if (!boardResp.ok) {
      return {
        rows: [],
        meta: null,
        error:
          typeof boardData.error === "string"
            ? boardData.error
            : "Não foi possível carregar o ranking.",
      };
    }

    return {
      rows: Array.isArray(boardData.rows) ? boardData.rows : [],
      meta: boardData.meta ?? emptyRankingBoardMeta(),
      error: null,
    };
  } catch {
    return {
      rows: [],
      meta: null,
      error: "Erro de rede ao carregar o ranking.",
    };
  }
}
