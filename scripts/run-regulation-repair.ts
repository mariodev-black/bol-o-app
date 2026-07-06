import fs from "node:fs";
import { repairRegulationTimeScores } from "../lib/football/finished-score-repair";

async function main() {
  const envPath = new URL("../.env", import.meta.url);
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i);
    let v = t.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] == null) process.env[k] = v;
  }

  const r = await repairRegulationTimeScores();
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
