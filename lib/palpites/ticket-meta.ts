import { getBolaoDefinitionById } from "@/lib/boloes/definitions/repository";
import type { BolaoDefinition } from "@/lib/boloes/definitions/types";
import { paidTicketDailyEditionNumber } from "@/lib/boloes/daily-editions";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";
import { isWeekendBolaoCompetition } from "@/lib/boloes/weekend-bolao-config";
import {
  isSkaleDailyBolaoCompetition,
  paidTicketSkaleDailyEditionNumber,
} from "@/lib/boloes/skale-daily-config";
import { getPool } from "@/lib/db";
import { getSoleConfiguredExtraChampionshipId } from "@/lib/boloes-extra-config";
import { effectiveExtraRoundForPaidTicket } from "@/lib/ticket-shop-extra-display";
import { extraBolaoCurrentRoundsByChampionship } from "@/lib/ticket-shop-extra-rounds";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind-server";
import { inferBolaoTypeFromTicketPrefix } from "@/lib/ticket-kind-shared";

type TicketMetaBase = {
  bolao: "principal" | "diario" | "extra";
  extraChampionshipId: number | null;
  extraRoundNumber: number | null;
  dailyEditionNumber: number | null;
};

export type OwnedTicketMeta = TicketMetaBase & {
  bolaoDefinitionId: string | null;
  bolaoDefinition: BolaoDefinition | null;
};

function isUuidTicketId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function attachDefinition(
  base: TicketMetaBase,
  bolaoDefinitionId: string | null,
  bolaoDefinition: BolaoDefinition | null,
): OwnedTicketMeta {
  return { ...base, bolaoDefinitionId, bolaoDefinition };
}

export async function resolveOwnedTicketMeta(
  userId: string,
  ticketId: string,
): Promise<OwnedTicketMeta | null> {
  const raw = ticketId.trim();
  if (!raw) return null;

  const fromPrefix = inferBolaoTypeFromTicketPrefix(raw);
  if (fromPrefix && !isUuidTicketId(raw)) {
    return attachDefinition(
      {
        bolao: fromPrefix,
        extraChampionshipId: null,
        extraRoundNumber: null,
        dailyEditionNumber: null,
      },
      null,
      null,
    );
  }

  if (isUuidTicketId(raw)) {
    const pool = getPool();
    const { rows } = await pool.query<{
      ticket_type: "general" | "daily" | "extra";
      extra_championship_id: number | null;
      round_number: number | null;
      bolao_definition_id: string | null;
    }>(
      `SELECT ticket_type, extra_championship_id, round_number, bolao_definition_id
       FROM tickets
       WHERE id::text = $1
         AND user_id = $2
         AND status = 'paid'
       LIMIT 1`,
      [raw, userId],
    );
    const row = rows[0];
    if (!row) return null;

    const definitionId = row.bolao_definition_id?.trim() || null;
    const bolaoDefinition = definitionId ? await getBolaoDefinitionById(definitionId) : null;

    if (row.ticket_type === "general") {
      return attachDefinition(
        {
          bolao: "principal",
          extraChampionshipId: bolaoDefinition?.competitionId ?? null,
          extraRoundNumber: null,
          dailyEditionNumber: null,
        },
        definitionId,
        bolaoDefinition,
      );
    }

    if (row.ticket_type === "daily") {
      const edition =
        bolaoDefinition?.editionNumber ??
        paidTicketDailyEditionNumber({
          ticketType: "daily",
          round_number: row.round_number,
        });
      return attachDefinition(
        {
          bolao: "diario",
          extraChampionshipId: null,
          extraRoundNumber: null,
          dailyEditionNumber: edition,
        },
        definitionId,
        bolaoDefinition,
      );
    }

    if (row.ticket_type === "extra") {
      const rnumRaw = row.round_number;
      const rnum =
        rnumRaw != null && Number.isFinite(Number(rnumRaw)) && Number(rnumRaw) > 0
          ? Number(rnumRaw)
          : null;
      const cid = row.extra_championship_id;
      const compId =
        bolaoDefinition?.competitionId ??
        (cid != null && Number.isFinite(Number(cid))
          ? Number(cid)
          : getSoleConfiguredExtraChampionshipId());

      if (compId != null && isSkaleDailyBolaoCompetition(compId)) {
        const edition = paidTicketSkaleDailyEditionNumber({
          ticketType: "extra",
          extraChampionshipId: compId,
          round_number: rnum,
        });
        return attachDefinition(
          {
            bolao: "extra",
            extraChampionshipId: compId,
            extraRoundNumber: edition,
            dailyEditionNumber: null,
          },
          definitionId,
          bolaoDefinition,
        );
      }
      if (compId != null && isSkaleBolaoCompetition(compId)) {
        return attachDefinition(
          {
            bolao: "extra",
            extraChampionshipId: compId,
            extraRoundNumber: null,
            dailyEditionNumber: null,
          },
          definitionId,
          bolaoDefinition,
        );
      }
      if (compId != null && isWeekendBolaoCompetition(compId)) {
        return attachDefinition(
          {
            bolao: "extra",
            extraChampionshipId: compId,
            extraRoundNumber: null,
            dailyEditionNumber: null,
          },
          definitionId,
          bolaoDefinition,
        );
      }
      if (compId != null) {
        const liveRounds = await extraBolaoCurrentRoundsByChampionship([compId]).catch(
          () => ({} as Record<number, { roundNumber: number }>),
        );
        return attachDefinition(
          {
            bolao: "extra",
            extraChampionshipId: compId,
            extraRoundNumber: effectiveExtraRoundForPaidTicket({
              championshipId: compId,
              roundNumberFromDb: rnum,
              liveRoundNumber: liveRounds[compId]?.roundNumber ?? null,
            }),
            dailyEditionNumber: null,
          },
          definitionId,
          bolaoDefinition,
        );
      }
      return null;
    }
    return null;
  }

  const inferred = await inferBolaoTypeFromTicketId(raw);
  if (!inferred || inferred === "artilheiros") return null;
  return attachDefinition(
    {
      bolao: inferred,
      extraChampionshipId: null,
      extraRoundNumber: null,
      dailyEditionNumber: null,
    },
    null,
    null,
  );
}
