/** Resposta amigável para erros comuns do driver `pg` / PostgreSQL. */
export function responseForDbError(e: unknown): { status: number; error: string } | null {
  const err = e as { code?: string; message?: string };
  const msg = typeof err.message === "string" ? err.message : "";

  if (msg.includes("client password must be a string")) {
    return {
      status: 503,
      error:
        "Configure DATABASE_PASSWORD no .env (texto puro, como no DBeaver) e reinicie o npm run dev. Se a linha estiver vazia ou comentada, o driver não consegue autenticar.",
    };
  }

  const code = err.code;

  if (code === "28P01" || code === "28000") {
    return {
      status: 503,
      error:
        "Não foi possível conectar ao banco: usuário ou senha incorretos. Confira os mesmos dados do DBeaver e reinicie o npm run dev. Se usa DATABASE_URL, caracteres como @ # / + na senha quebram a URL — use DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD e DATABASE_NAME no .env (como no DBeaver).",
    };
  }

  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
    return {
      status: 503,
      error: "Banco de dados inacessível (rede ou host). Verifique DATABASE_URL e firewall.",
    };
  }

  if (code === "3D000") {
    return {
      status: 503,
      error: "O nome do banco em DATABASE_URL não existe neste servidor.",
    };
  }

  if (msg.includes("is_promo_bonus")) {
    return {
      status: 503,
      error:
        "Banco desatualizado para a promo de Brasileirão grátis. Execute scripts/sql/20260516-tickets-promo-bonus.sql no Postgres e reinicie o app.",
    };
  }

  if (msg.includes("tickets_total_amount_cents_check") || msg.includes("tickets_unit_price_cents_check")) {
    return {
      status: 503,
      error:
        "Banco desatualizado: cotas grátis da promo precisam da migration scripts/sql/20260516-tickets-promo-bonus.sql.",
    };
  }

  return null;
}
