import "dotenv/config";
import { resolveCurrentExtraRound, resolveEffectiveExtraRoundForTicket } from "@/lib/football/extras-rodada";

const COMP = 14;

async function main() {
  const current = await resolveCurrentExtraRound(COMP, { allowProviderCall: false });
  console.log("current extra round:", current);

  const effective12 = await resolveEffectiveExtraRoundForTicket(COMP, 12, {
    allowProviderCall: false,
  });
  console.log("effective for ticket round 12:", effective12);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
