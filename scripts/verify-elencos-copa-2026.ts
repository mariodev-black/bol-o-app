/**
 * Valida app/shared/elencos-copa-2026.json (estrutura + contagens).
 * Run: npm run verify:elencos
 */
import { buildElencosCatalog, validateElencosJson } from "@/lib/artilheiros/elencos-json";

function main() {
  const report = validateElencosJson();
  const { meta } = buildElencosCatalog();

  console.log("=== elencos-copa-2026.json ===");
  console.log("Competição:", meta.competicao, meta.season);
  console.log("Atualizado em:", meta.atualizadoEm);
  console.log("");
  console.log("Entradas brutas (selecoes[]):", report.stats.rawSelecoes);
  console.log("Seleções únicas (deduplicadas):", report.stats.uniqueTeams);
  console.log("Jogadores únicos:", report.stats.uniquePlayers);
  console.log("Esperado (competicao/resumo):", report.stats.expectedTeams, "times,", report.stats.expectedPlayers, "jogadores");

  if (report.warnings.length > 0) {
    console.log("\nAvisos:");
    for (const w of report.warnings) console.warn("  -", w);
  }

  if (!report.ok) {
    console.error("\nErros:");
    for (const e of report.errors) console.error("  -", e);
    process.exit(1);
  }

  const catalog = buildElencosCatalog();
  const brasil = catalog.teams.find((t) => t.codigo === "BRA");
  const attackers = (catalog.playersByTeam.get(brasil?.apiTeamId ?? 0) ?? []).filter(
    (p) => p.posicao === "Attacker",
  );

  console.log("\nAmostra Brasil:", brasil?.displayNome, brasil?.grupoLabel, `(${brasil?.totalJogadores} jogadores)`);
  console.log("Atacantes Brasil (primeiros 3):", attackers.slice(0, 3).map((p) => p.nome).join(", "));
  console.log("\n[OK] JSON válido e alinhado com o parser do app.");
}

main();
