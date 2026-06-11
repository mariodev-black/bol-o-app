/**
 * Push PWA quando o placar de uma partida muda — um aviso por palpite
 * (usuário + cota/ticket + partida), só para quem tem subscription ativa.
 */

import { getPool } from "@/lib/db";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { isWebPushConfigured } from "@/lib/push/config";
import { rankingPalpitePushPath } from "@/lib/push/ranking-push-url";
import { sendPushToUserIds } from "@/lib/push/send";

type PalpitePushRow = {
  user_id: string;
  ticket_id: string;
  match_id: number;
  score_casa: number;
  score_visitante: number;
  points: number;
  home_sigla: string | null;
  away_sigla: string | null;
  home_name: string | null;
  away_name: string | null;
  result_casa: number | null;
  result_visitante: number | null;
};

function scoreNotifyEnabled(): boolean {
  const raw = (process.env.PUSH_SCORE_CHANGE_NOTIFY ?? "true").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "no";
}

function teamLabel(sigla: string | null, name: string | null): string {
  const s = String(sigla ?? "").trim();
  if (s.length >= 2) return s.slice(0, 3).toUpperCase();
  const n = String(name ?? "").trim();
  if (n.length >= 2) return n.slice(0, 3).toUpperCase();
  return "???";
}

function formatPushCopy(row: PalpitePushRow): { title: string; body: string } {
  const home = teamLabel(row.home_sigla, row.home_name);
  const away = teamLabel(row.away_sigla, row.away_name);
  const rc = row.result_casa ?? 0;
  const rv = row.result_visitante ?? 0;
  const title = `${home} ${rc} × ${rv} ${away}`;
  const pts =
    row.points > 0 ? `+${row.points} pt${row.points === 1 ? "" : "s"}` : "0 pts";
  const body = `Seu palpite ${row.score_casa}×${row.score_visitante} · ${pts}. Toque para ver no ranking.`;
  return { title, body };
}

async function loadPalpitesForPush(matchIds: number[]): Promise<PalpitePushRow[]> {
  if (matchIds.length === 0) return [];
  const pool = getPool();
  const mainComp = getFootballMainCompetitionId();
  const { rows } = await pool.query<PalpitePushRow>(
    `SELECT
       p.user_id::text           AS user_id,
       p.ticket_id::text         AS ticket_id,
       p.match_id                AS match_id,
       p.score_casa              AS score_casa,
       p.score_visitante         AS score_visitante,
       ps.points                 AS points,
       mc.home_sigla             AS home_sigla,
       mc.away_sigla             AS away_sigla,
       mc.home_name              AS home_name,
       mc.away_name              AS away_name,
       mc.result_casa            AS result_casa,
       mc.result_visitante       AS result_visitante
     FROM predictions p
     INNER JOIN prediction_scores ps ON ps.prediction_id = p.id
     INNER JOIN tickets t ON t.id::text = p.ticket_id
     INNER JOIN matches_cache mc ON mc.match_id = p.match_id
       AND mc.competition_id = CASE
         WHEN p.bolao_type = 'extra' THEN t.extra_championship_id
         ELSE $2::int
       END
     WHERE p.match_id = ANY($1::bigint[])
       AND mc.result_casa IS NOT NULL
       AND mc.result_visitante IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM push_subscriptions sub
         WHERE sub.user_id = p.user_id
       )`,
    [matchIds, mainComp],
  );
  return rows;
}

export type ScoreChangePushResult = {
  matchIds: number[];
  recipients: number;
  sent: number;
  failed: number;
  expired: number;
  skipped?: string;
};

/**
 * Dispara push para cada palpite afetado quando o placar muda.
 * Deve ser chamado após `prediction_scores` estar atualizado.
 */
export async function dispatchScoreChangePushNotifications(
  matchIds: number[],
): Promise<ScoreChangePushResult> {
  const uniqueMatchIds = [
    ...new Set(matchIds.filter((n) => Number.isFinite(n) && n > 0)),
  ];
  const empty: ScoreChangePushResult = {
    matchIds: uniqueMatchIds,
    recipients: 0,
    sent: 0,
    failed: 0,
    expired: 0,
  };

  if (uniqueMatchIds.length === 0) return empty;
  if (!scoreNotifyEnabled() || !isWebPushConfigured()) {
    return { ...empty, skipped: "disabled-or-unconfigured" };
  }

  const rows = await loadPalpitesForPush(uniqueMatchIds);
  if (rows.length === 0) return empty;

  let sent = 0;
  let failed = 0;
  let expired = 0;

  for (const row of rows) {
    const { title, body } = formatPushCopy(row);
    const result = await sendPushToUserIds({
      userIds: [row.user_id],
      payload: {
        title,
        body,
        url: rankingPalpitePushPath(row.ticket_id, row.match_id),
        tag: `palpite-score:${row.match_id}:${row.ticket_id}`,
      },
    });
    sent += result.sent;
    failed += result.failed;
    expired += result.expired;
  }

  if (sent > 0) {
    console.info("[push/score-change]", {
      matches: uniqueMatchIds.length,
      recipients: rows.length,
      sent,
      failed,
      expired,
    });
  }

  return {
    matchIds: uniqueMatchIds,
    recipients: rows.length,
    sent,
    failed,
    expired,
  };
}
