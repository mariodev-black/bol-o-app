/**
 * "Palpites dos jogadores" — últimos palpites de TODOS os participantes de um bolão.
 * Mostra mesmo antes do apito (decisão do produto). Escopo por competição/bolão,
 * nunca mistura bolões (synthetic comps compartilham match_id → filtrar por comp/ticket).
 */

import { getPool } from "@/lib/db";
import { matchesCacheCompetitionIdForBolao } from "@/lib/boloes/match-cache-competition-id";
import { clampAvatarIndex } from "@/lib/auth/avatar-index";
import { isStoredAvatarUploadFilename } from "@/lib/user/avatar-filename";

export type PlayerPalpiteRow = {
  userId: string;
  displayName: string;
  avatarIndex: number;
  avatarUploadFilename: string | null;
  matchId: number;
  homeName: string;
  homeSigla: string | null;
  homeLogo: string | null;
  awayName: string;
  awaySigla: string | null;
  awayLogo: string | null;
  dateBR: string | null;
  hour: string | null;
  kickoffAt: string | null;
  status: string | null;
  resultCasa: number | null;
  resultVisitante: number | null;
  scoreCasa: number;
  scoreVisitante: number;
  submittedAtMs: number;
};

type DbRow = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  email: string | null;
  avatar_index: string | number | null;
  avatar_upload_filename: string | null;
  match_id: string | number;
  home_name: string | null;
  home_sigla: string | null;
  home_logo: string | null;
  away_name: string | null;
  away_sigla: string | null;
  away_logo: string | null;
  date_br: string | null;
  hour_br: string | null;
  kickoff_at: string | null;
  status: string | null;
  result_casa: number | null;
  result_visitante: number | null;
  score_casa: number;
  score_visitante: number;
  ord: Date | string;
};

function avatarIndexFromDb(v: string | number | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return clampAvatarIndex(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseInt(v, 10);
    if (!Number.isNaN(n)) return clampAvatarIndex(n);
  }
  return clampAvatarIndex(0);
}

function safeUploadFilename(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t && isStoredAvatarUploadFilename(t) ? t : null;
}

function displayName(r: DbRow): string {
  const nick = typeof r.nickname === "string" ? r.nickname.trim() : "";
  if (nick) return nick;
  const n = typeof r.name === "string" ? r.name.trim() : "";
  if (n) return n;
  const email = typeof r.email === "string" ? r.email.trim() : "";
  const local = email.split("@")[0] ?? "";
  return local || "Jogador";
}

/**
 * Últimos palpites dos jogadores num bolão.
 * - extra → escopo por `tickets.extra_championship_id` (comp = championship)
 * - principal/diario → comp = campeonato principal
 * Junta `matches_cache` pela MESMA comp para pegar times/logo e evitar misturar bolões.
 */
export async function listRecentPlayerPalpites(opts: {
  bolaoType: "principal" | "diario" | "extra";
  extraChampionshipId?: number | null;
  limit?: number;
}): Promise<PlayerPalpiteRow[]> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 80));
  const matchComp = matchesCacheCompetitionIdForBolao(
    opts.bolaoType,
    opts.extraChampionshipId,
  );

  const params: unknown[] = [opts.bolaoType, matchComp];
  let extraScope = "";
  if (opts.bolaoType === "extra") {
    const cid = Number(opts.extraChampionshipId);
    if (!Number.isFinite(cid) || cid <= 0) return [];
    params.push(cid);
    extraScope = `AND t.extra_championship_id = $${params.length}`;
  }
  params.push(limit);
  const limitIdx = params.length;

  const pool = getPool();
  const { rows } = await pool.query<DbRow>(
    `SELECT
        p.user_id::text       AS user_id,
        u.name                AS name,
        u.nickname            AS nickname,
        u.email               AS email,
        u.avatar_index        AS avatar_index,
        u.avatar_upload_filename AS avatar_upload_filename,
        p.match_id            AS match_id,
        m.home_name           AS home_name,
        m.home_sigla          AS home_sigla,
        m.home_logo           AS home_logo,
        m.away_name           AS away_name,
        m.away_sigla          AS away_sigla,
        m.away_logo           AS away_logo,
        m.date_br             AS date_br,
        m.hour_br             AS hour_br,
        m.kickoff_at::text    AS kickoff_at,
        m.status              AS status,
        m.result_casa         AS result_casa,
        m.result_visitante    AS result_visitante,
        p.score_casa          AS score_casa,
        p.score_visitante     AS score_visitante,
        m.kickoff_at          AS ord
      FROM predictions p
      INNER JOIN tickets t ON t.id::text = p.ticket_id::text
      INNER JOIN users u ON u.id::text = p.user_id::text
      INNER JOIN matches_cache m
              ON m.competition_id = $2::int
             AND m.match_id = p.match_id
      WHERE p.bolao_type = $1
        AND t.status IN ('paid', 'approved')
        AND m.kickoff_at IS NOT NULL
        AND m.kickoff_at <= NOW()
        ${extraScope}
      ORDER BY m.kickoff_at DESC,
               GREATEST(p.submitted_at, COALESCE(p.updated_at, p.submitted_at)) DESC
      LIMIT $${limitIdx}`,
    params,
  );

  return rows.map((r) => ({
    userId: r.user_id,
    displayName: displayName(r),
    avatarIndex: avatarIndexFromDb(r.avatar_index),
    avatarUploadFilename: safeUploadFilename(r.avatar_upload_filename),
    matchId: Number(r.match_id),
    homeName: r.home_name ?? "",
    homeSigla: r.home_sigla,
    homeLogo: r.home_logo,
    awayName: r.away_name ?? "",
    awaySigla: r.away_sigla,
    awayLogo: r.away_logo,
    dateBR: r.date_br,
    hour: r.hour_br,
    kickoffAt: r.kickoff_at,
    status: r.status,
    resultCasa: r.result_casa,
    resultVisitante: r.result_visitante,
    scoreCasa: Number(r.score_casa),
    scoreVisitante: Number(r.score_visitante),
    submittedAtMs: new Date(r.ord).getTime(),
  }));
}
