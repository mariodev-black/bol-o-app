import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ArtilheirosPickClient from "./ArtilheirosPickClient";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { listArtilheiroPicksForTicket } from "@/lib/artilheiros/picks";
import { isArtilheiroResultApplied, listArtilheiroOfficialResults } from "@/lib/artilheiros/results";
import { getArtilheiroElencosBundle } from "@/lib/artilheiros/elencos";
import {
  ARTILHEIRO_SLOT_EMOJI,
  ARTILHEIRO_SLOT_LABELS,
  ARTILHEIRO_SLOT_POINTS,
  ARTILHEIRO_TOP3_BONUS,
  ARTILHEIROS_BOLAO_TITLE,
} from "@/lib/artilheiros/config";

export const dynamic = "force-dynamic";

export default async function ArtilheirosPalpitesPage(props: {
  searchParams?: Promise<{ ticket?: string }> | { ticket?: string };
}) {
  const searchParams =
    props.searchParams && typeof (props.searchParams as Promise<{ ticket?: string }>).then === "function"
      ? await (props.searchParams as Promise<{ ticket?: string }>)
      : (props.searchParams as { ticket?: string } | undefined);
  const ticketId = searchParams?.ticket?.trim();
  if (!ticketId) redirect("/boloes");

  const token = (await cookies()).get(sessionCookieName())?.value;
  const userId = token ? await verifySessionToken(token).catch(() => null) : null;
  if (!userId) redirect("/login");

  let ticketOk = false;
  try {
    const pool = getPool();
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id::text FROM tickets
       WHERE id = $1 AND user_id = $2 AND ticket_type = 'artilheiros' AND status = 'paid'
       LIMIT 1`,
      [ticketId, userId],
    );
    ticketOk = Boolean(rows[0]);
  } catch (error) {
    console.error("[palpites/artilheiros] ticket lookup failed", error);
  }
  if (!ticketOk) redirect("/boloes");

  const elencos = getArtilheiroElencosBundle();
  const [picks, results] = await Promise.all([
    listArtilheiroPicksForTicket(ticketId).catch(() => []),
    listArtilheiroOfficialResults().catch(() => []),
  ]);

  return (
    <ArtilheirosPickClient
      ticketId={ticketId}
      initialPicks={picks}
      resultsApplied={isArtilheiroResultApplied(results)}
      allTeams={elencos.teams}
      playersByTeam={elencos.playersByTeam}
      scoringRules={{
        title: ARTILHEIROS_BOLAO_TITLE,
        slots: [
          { slot: 1, emoji: ARTILHEIRO_SLOT_EMOJI[1], label: ARTILHEIRO_SLOT_LABELS[1], points: ARTILHEIRO_SLOT_POINTS[1] },
          { slot: 2, emoji: ARTILHEIRO_SLOT_EMOJI[2], label: ARTILHEIRO_SLOT_LABELS[2], points: ARTILHEIRO_SLOT_POINTS[2] },
          { slot: 3, emoji: ARTILHEIRO_SLOT_EMOJI[3], label: ARTILHEIRO_SLOT_LABELS[3], points: ARTILHEIRO_SLOT_POINTS[3] },
        ],
        top3Bonus: ARTILHEIRO_TOP3_BONUS,
      }}
    />
  );
}
