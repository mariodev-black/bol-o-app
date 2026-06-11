/**
 * Migração Bolão dos Artilheiros — schema + catálogo do elencos-copa-2026.json
 *
 * Local:  npm run db:artilheiros
 * Server: sudo bash scripts/setup-artilheiros-bolao.sh
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "@/lib/db";
import { buildElencosCatalog, validateElencosJson } from "@/lib/artilheiros/elencos-json";

const SQL_FILE = join(process.cwd(), "scripts/sql/20260610-artilheiros-bolao.sql");

async function applySqlFile() {
  const pool = getPool();
  const sql = readFileSync(SQL_FILE, "utf8");
  await pool.query(sql);
  console.log("[OK] SQL aplicado:", SQL_FILE);
}

async function syncCatalog() {
  const report = validateElencosJson();
  console.log("[INFO] Validação JSON:", report.stats);
  if (!report.ok) {
    for (const e of report.errors) console.error("[ERRO]", e);
    throw new Error("elencos-copa-2026.json inválido — corrija antes de migrar");
  }
  for (const w of report.warnings) console.warn("[AVISO]", w);

  const { teams, playersByTeam, meta } = buildElencosCatalog();
  const catalogVersion = meta.atualizadoEm;
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const t of teams) {
      await client.query(
        `INSERT INTO artilheiro_catalog_teams (
           api_team_id, nome, display_nome, codigo, pais, logo,
           grupo, grupo_label, rank, descricao, total_jogadores, catalog_version, synced_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
         ON CONFLICT (api_team_id) DO UPDATE SET
           nome = EXCLUDED.nome,
           display_nome = EXCLUDED.display_nome,
           codigo = EXCLUDED.codigo,
           pais = EXCLUDED.pais,
           logo = EXCLUDED.logo,
           grupo = EXCLUDED.grupo,
           grupo_label = EXCLUDED.grupo_label,
           rank = EXCLUDED.rank,
           descricao = EXCLUDED.descricao,
           total_jogadores = EXCLUDED.total_jogadores,
           catalog_version = EXCLUDED.catalog_version,
           synced_at = now()`,
        [
          t.apiTeamId,
          t.nome,
          t.displayNome,
          t.codigo,
          t.pais,
          t.logo,
          t.grupo,
          t.grupoLabel,
          t.rank,
          t.descricao,
          t.totalJogadores,
          catalogVersion,
        ],
      );
    }

    let playerCount = 0;
    for (const t of teams) {
      const players = playersByTeam.get(t.apiTeamId) ?? [];
      for (const p of players) {
        await client.query(
          `INSERT INTO artilheiro_catalog_players (
             api_player_id, api_team_id, nome, idade, numero,
             posicao, posicao_label, foto, catalog_version, synced_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
           ON CONFLICT (api_player_id) DO UPDATE SET
             api_team_id = EXCLUDED.api_team_id,
             nome = EXCLUDED.nome,
             idade = EXCLUDED.idade,
             numero = EXCLUDED.numero,
             posicao = EXCLUDED.posicao,
             posicao_label = EXCLUDED.posicao_label,
             foto = EXCLUDED.foto,
             catalog_version = EXCLUDED.catalog_version,
             synced_at = now()`,
          [
            p.apiPlayerId,
            p.apiTeamId,
            p.nome,
            p.idade,
            p.numero,
            p.posicao,
            p.posicaoLabel,
            p.foto,
            catalogVersion,
          ],
        );
        playerCount += 1;
      }
    }

    await client.query("COMMIT");
    console.log(`[OK] Catálogo sincronizado: ${teams.length} seleções, ${playerCount} jogadores`);
    console.log(`[OK] Versão catálogo: ${catalogVersion} (${meta.competicao})`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function verifyDb() {
  const pool = getPool();
  const tables = [
    "artilheiro_catalog_teams",
    "artilheiro_catalog_players",
    "artilheiro_picks",
    "artilheiro_official_results",
    "artilheiro_ticket_scores",
  ];

  for (const table of tables) {
    const { rows } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS exists`,
      [table],
    );
    if (!rows[0]?.exists) throw new Error(`Tabela ausente: ${table}`);
    console.log(`[OK] Tabela ${table}`);
  }

  const enumCheck = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'ticket_type_enum' AND e.enumlabel = 'artilheiros'
     ) AS exists`,
  );
  if (!enumCheck.rows[0]?.exists) {
    throw new Error("Enum ticket_type_enum sem valor 'artilheiros'");
  }
  console.log("[OK] Enum ticket_type_enum + artilheiros");

  const { rows: counts } = await pool.query<{
    teams: string;
    players: string;
  }>(
    `SELECT
       (SELECT COUNT(*)::text FROM artilheiro_catalog_teams) AS teams,
       (SELECT COUNT(*)::text FROM artilheiro_catalog_players) AS players`,
  );
  const teams = Number(counts[0]?.teams ?? 0);
  const players = Number(counts[0]?.players ?? 0);
  console.log(`[OK] Catálogo no DB: ${teams} seleções, ${players} jogadores`);

  const report = validateElencosJson();
  if (teams !== report.stats.uniqueTeams) {
    throw new Error(`DB teams=${teams}, JSON esperado=${report.stats.uniqueTeams}`);
  }
  if (players !== report.stats.uniquePlayers) {
    throw new Error(`DB players=${players}, JSON esperado=${report.stats.uniquePlayers}`);
  }

  const bra = await pool.query<{ display_nome: string; total: string }>(
    `SELECT display_nome, total_jogadores::text AS total
     FROM artilheiro_catalog_teams WHERE codigo = 'BRA' LIMIT 1`,
  );
  if (bra.rows[0]) {
    console.log(`[OK] Brasil no catálogo: ${bra.rows[0].display_nome} (${bra.rows[0].total} jogadores)`);
  }
}

async function main() {
  console.log("=== Bolão dos Artilheiros — migração ===");
  await applySqlFile();
  await syncCatalog();
  await verifyDb();
  console.log("=== Migração concluída com sucesso ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("[FALHA]", err instanceof Error ? err.message : err);
  process.exit(1);
});
