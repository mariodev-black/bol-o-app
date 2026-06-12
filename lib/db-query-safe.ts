import type { Pool, QueryResult, QueryResultRow } from "pg";
import { getPool } from "@/lib/db";

const DEFAULT_QUERY_TIMEOUT_MS = Math.max(
  3_000,
  Math.min(
    30_000,
    Number.parseInt(process.env.DATABASE_QUERY_TIMEOUT_MS ?? "12000", 10) || 12_000,
  ),
);

class QueryTimeoutError extends Error {
  constructor(ms: number) {
    super(`Query timeout after ${ms}ms`);
    this.name = "QueryTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new QueryTimeoutError(ms)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Query Postgres com timeout — nunca propaga exceção (retorna fallback).
 */
export async function querySafe<R extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
  opts?: {
    pool?: Pool;
    timeoutMs?: number;
    fallbackRows?: R[];
    label?: string;
  },
): Promise<QueryResult<R>> {
  const pool = opts?.pool ?? getPool();
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
  const fallbackRows = opts?.fallbackRows ?? [];

  try {
    return await withTimeout(pool.query<R>(sql, params), timeoutMs);
  } catch (error) {
    if (opts?.label) {
      console.error(`[db-query-safe:${opts.label}]`, error);
    } else {
      console.error("[db-query-safe]", error);
    }
    return {
      rows: fallbackRows,
      rowCount: fallbackRows.length,
      command: "SELECT",
      oid: 0,
      fields: [],
    } as QueryResult<R>;
  }
}
