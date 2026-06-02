/**
 * Verificações rápidas do brinde extra (Série B + Amistosos).
 * Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/test-extra-gift-promo.ts
 */

import assert from "node:assert/strict";
import { formatShortTicketId } from "../lib/tickets/short-ticket-id";
import {
  AMISTOSOS_FRIENDLY_MATCHES,
  getAmistososFriendliesCompetitionId,
  isAmistososFriendliesCompetition,
  isSerieBExtraGiftChampionship,
} from "../lib/football/amistosos-friendlies";
import { resolveNationalTeamShieldUrl } from "../lib/football/national-team-shields";

function ok(label: string) {
  console.log(`  ✓ ${label}`);
}

function main() {
  console.log("test-extra-gift-promo\n");

  assert.equal(formatShortTicketId("a1b2c3d4-e5f6-7890-abcd-ef1234567890"), "A1B2C3");
  assert.equal(formatShortTicketId(""), "------");
  ok("formatShortTicketId");

  const amistososId = getAmistososFriendliesCompetitionId();
  assert.ok(isAmistososFriendliesCompetition(amistososId));
  assert.ok(isSerieBExtraGiftChampionship(14));
  assert.ok(!isAmistososFriendliesCompetition(14));
  ok("competition ids");

  assert.equal(AMISTOSOS_FRIENDLY_MATCHES.length, 5);
  assert.ok(resolveNationalTeamShieldUrl("Brasil")?.includes("http"));
  ok("amistosos matches + escudos");

  console.log("\nTudo ok.\n");
}

main();
