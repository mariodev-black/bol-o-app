import { getPool } from "@/lib/db";
import { normalizeTransactionalEmail } from "@/lib/email/address";

/**
 * Verifica se existe usuário com este e-mail (mesma regra do login/cadastro).
 */
export async function userExistsByEmail(emailRaw: string): Promise<boolean> {
  const email = normalizeTransactionalEmail(emailRaw);
  if (!email) return false;

  const pool = getPool();
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM users WHERE lower(trim(email)) = $1
     ) AS exists`,
    [email],
  );
  return Boolean(rows[0]?.exists);
}
