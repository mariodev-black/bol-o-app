import { Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

function sslOption(): PoolConfig["ssl"] | undefined {
  return process.env.DATABASE_SSL === "1" || process.env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: false }
    : undefined;
}

/** Leitura dinâmica evita que o bundler substitua `process.env.X` por `undefined` no build. */
function envStr(name: string): string {
  const raw = process.env[name];
  if (raw == null) return "";
  return String(raw);
}

/** Remove aspas acidentais em valores do .env ("...' ou '...') */
function stripEnvQuotes(value: string): string {
  const t = value.trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return t.slice(1, -1);
    }
  }
  return t;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function intEnvNonNeg(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (raw === "" || raw == null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Use `DATABASE_HOST` + `DATABASE_USER` + `DATABASE_PASSWORD` + `DATABASE_NAME`
 * quando a senha tiver @, #, /, +, %, etc. — igual ao DBeaver, sem codificar na URL.
 * Se `DATABASE_HOST` estiver definido, essas variáveis têm prioridade sobre `DATABASE_URL`.
 */
function poolConfigFromEnv(): PoolConfig {
  const ssl = sslOption();
  const host = envStr("DATABASE_HOST").trim();

  if (host) {
    const port = parseInt(envStr("DATABASE_PORT").trim() || "5432", 10);
    const user = envStr("DATABASE_USER").trim();
    const database = envStr("DATABASE_NAME").trim();
    // SCRAM exige string; nunca envie `undefined` ao `pg`
    const password = envStr("DATABASE_PASSWORD");

    if (!user || !database) {
      throw new Error(
        "Com DATABASE_HOST, defina também DATABASE_USER e DATABASE_NAME (e DATABASE_PASSWORD se houver senha)."
      );
    }

    return {
      host,
      port: Number.isFinite(port) ? port : 5432,
      user,
      password,
      database,
      ssl,
    };
  }

  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "Defina DATABASE_URL ou então DATABASE_HOST + DATABASE_USER + DATABASE_NAME (+ DATABASE_PASSWORD). " +
        "Se a senha tiver caracteres especiais, use as variáveis separadas (como no DBeaver)."
    );
  }

  return {
    connectionString: stripEnvQuotes(raw),
    ssl,
  };
}

function poolScalingOptions(): Pick<PoolConfig, "max" | "min" | "idleTimeoutMillis" | "connectionTimeoutMillis"> {
  const max = Math.max(1, intEnv("DATABASE_POOL_MAX", 20));
  const min = Math.min(intEnvNonNeg("DATABASE_POOL_MIN", 0), max);
  return {
    max,
    min,
    idleTimeoutMillis: intEnv("DATABASE_POOL_IDLE_MS", 30_000),
    connectionTimeoutMillis: intEnv("DATABASE_POOL_CONN_TIMEOUT_MS", 10_000),
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      ...poolConfigFromEnv(),
      ...poolScalingOptions(),
      allowExitOnIdle: process.env.DATABASE_POOL_ALLOW_EXIT_ON_IDLE === "1",
    });
  }
  return pool;
}
