import {
  ARTILHEIRO_SLOT_POINTS,
  ARTILHEIRO_TOP3_BONUS,
  type ArtilheiroPickSlot,
} from "@/lib/artilheiros/config";
import type { ArtilheiroOfficialResultRow, ArtilheiroPickRow } from "@/lib/artilheiros/types";

export type ArtilheiroScoreBreakdown = {
  positionPoints: number;
  bonusPoints: number;
  totalPoints: number;
  slotDetails: Array<{
    slot: ArtilheiroPickSlot;
    pickPlayerId: number;
    officialPlayerId: number | null;
    positionHit: boolean;
    positionPoints: number;
    inTop3Bonus: boolean;
    bonusPoints: number;
  }>;
};

export function calcArtilheiroScore(
  picks: ArtilheiroPickRow[],
  official: ArtilheiroOfficialResultRow[],
): ArtilheiroScoreBreakdown {
  const officialBySlot = new Map(official.map((r) => [r.slot, r]));
  const top3PlayerIds = new Set(official.map((r) => r.apiPlayerId));

  let positionPoints = 0;
  let bonusPoints = 0;
  const slotDetails: ArtilheiroScoreBreakdown["slotDetails"] = [];

  for (const pick of picks) {
    const off = officialBySlot.get(pick.slot);
    const positionHit = off != null && off.apiPlayerId === pick.apiPlayerId;
    const posPts = positionHit ? ARTILHEIRO_SLOT_POINTS[pick.slot] : 0;
    const inTop3 = top3PlayerIds.has(pick.apiPlayerId);
    const bonus = inTop3 ? ARTILHEIRO_TOP3_BONUS : 0;
    positionPoints += posPts;
    bonusPoints += bonus;
    slotDetails.push({
      slot: pick.slot,
      pickPlayerId: pick.apiPlayerId,
      officialPlayerId: off?.apiPlayerId ?? null,
      positionHit,
      positionPoints: posPts,
      inTop3Bonus: inTop3,
      bonusPoints: bonus,
    });
  }

  return {
    positionPoints,
    bonusPoints,
    totalPoints: positionPoints + bonusPoints,
    slotDetails,
  };
}
