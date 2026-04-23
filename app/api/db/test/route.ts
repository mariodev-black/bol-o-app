import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { responseForDbError } from "@/lib/db-errors";

export const runtime = "nodejs";

/**
 * Teste de conexão + verifica se a tabela `users` existe (login/cadastro).
 * GET /api/db/test
 */
export async function GET() {
  const started = Date.now();
  try {
    const pool = getPool();
    const { rows } = await pool.query<{ v: number | string }>("SELECT 1 as v");
    const v = rows[0]?.v;
    const check = v === 1 || v === "1";

    const { rows: meta } = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists`
    );
    const usersTableExists = Boolean(meta[0]?.exists);

    const ms = Date.now() - started;
    return NextResponse.json({
      ok: true,
      message: "Conexão com o banco OK",
      latencyMs: ms,
      check,
      usersTableExists,
      authReady: usersTableExists,
      ...(usersTableExists
        ? {}
        : {
            schemaHint:
              "A tabela public.users ainda não existe. Rode uma vez o SQL em scripts/auth-schema.sql (no DBeaver: abrir o arquivo e executar, ou no terminal: psql com a mesma conexão do .env).",
          }),
    });
  } catch (e: unknown) {
    const db = responseForDbError(e);
    if (db) {
      return NextResponse.json(
        { ok: false, message: db.error, latencyMs: Date.now() - started },
        { status: db.status }
      );
    }
    const err = e as { message?: string };
    console.error("[db/test]", e);
    return NextResponse.json(
      {
        ok: false,
        message: err.message ?? "Falha desconhecida ao conectar",
        latencyMs: Date.now() - started,
      },
      { status: 500 }
    );
  }
}
