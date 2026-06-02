/**
 * Lista seleções em /campeonatos/72/partidas e imprime entradas para national-team-shields.ts
 *
 * Uso: FOOTBALL_API_TOKEN=... npx tsx scripts/fetch-national-team-shields.ts
 */

const BASE = "https://api.api-futebol.com.br/v1";

async function main() {
  const token = process.env.FOOTBALL_API_TOKEN?.trim();
  if (!token) {
    console.error("Defina FOOTBALL_API_TOKEN");
    process.exit(1);
  }

  const res = await fetch(`${BASE}/campeonatos/72/partidas`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error("HTTP", res.status, await res.text());
    process.exit(1);
  }

  const json: unknown = await res.json();
  const teams = new Map<string, string>();

  function walk(o: unknown): void {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) {
      o.forEach(walk);
      return;
    }
    const rec = o as Record<string, unknown>;
    const mandante = rec.time_mandante as Record<string, unknown> | undefined;
    const visitante = rec.time_visitante as Record<string, unknown> | undefined;
    if (mandante && visitante) {
      for (const t of [mandante, visitante]) {
        const name = String(t.nome_popular ?? t.nome ?? t.sigla ?? "").trim();
        const logo = String(t.escudo ?? t.logo ?? "").trim();
        if (name && logo && !teams.has(name)) teams.set(name, logo);
      }
    }
    Object.values(rec).forEach(walk);
  }

  walk(json);

  const sorted = [...teams.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  console.log("// Cole em lib/football/national-team-shields.ts\n");
  for (const [name, shieldUrl] of sorted) {
    console.log(`  { name: ${JSON.stringify(name)}, shieldUrl: ${JSON.stringify(shieldUrl)} },`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
