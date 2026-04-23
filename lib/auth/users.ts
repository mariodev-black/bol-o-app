import { getPool } from "@/lib/db";
import { allocateUniqueReferralCode, findUserIdByReferralCode } from "@/lib/auth/referral-code";

const U =
  "id, email, cpf, password_hash, name, phone, avatar_url, google_sub, email_verified_at, referral_code, referred_by_user_id";

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  referralCode: string;
};

type UserRow = {
  id: string;
  email: string;
  cpf: string | null;
  password_hash: string | null;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  google_sub: string | null;
  email_verified_at: Date | null;
  referral_code: string | null;
  referred_by_user_id: string | null;
};

function toPublic(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    referralCode: row.referral_code ?? "",
  };
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const pool = getPool();
  const { rows } = await pool.query<UserRow>(
    `SELECT ${U} FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  const row = rows[0];
  return row ? toPublic(row) : null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<UserRow>(
    `SELECT ${U} FROM users WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

/** Antes do INSERT: indica exatamente o que já existe (mesma lógica do cadastro). */
export async function getRegistrationConflicts(
  email: string,
  cpf11: string
): Promise<{ emailTaken: boolean; cpfTaken: boolean }> {
  const pool = getPool();
  const { rows } = await pool.query<{ email_taken: boolean; cpf_taken: boolean }>(
    `SELECT
       EXISTS (SELECT 1 FROM users WHERE lower(trim(email)) = lower(trim($1))) AS email_taken,
       EXISTS (SELECT 1 FROM users WHERE cpf = $2) AS cpf_taken`,
    [email, cpf11]
  );
  const r = rows[0];
  return {
    emailTaken: Boolean(r?.email_taken),
    cpfTaken: Boolean(r?.cpf_taken),
  };
}

export async function findUserByCpf(cpf11: string): Promise<UserRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<UserRow>(
    `SELECT ${U} FROM users WHERE cpf = $1 LIMIT 1`,
    [cpf11]
  );
  return rows[0] ?? null;
}

export async function findUserByGoogleSub(sub: string): Promise<UserRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<UserRow>(
    `SELECT ${U} FROM users WHERE google_sub = $1 LIMIT 1`,
    [sub]
  );
  return rows[0] ?? null;
}

export type ReferredUserSummary = {
  id: string;
  name: string | null;
  createdAt: string;
};

/** Lista contas criadas usando o código de indicação deste usuário. */
export async function listUsersReferredBy(referrerUserId: string): Promise<ReferredUserSummary[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string; name: string | null; created_at: Date }>(
    `SELECT id, name, created_at
     FROM users
     WHERE referred_by_user_id = $1
     ORDER BY created_at DESC`,
    [referrerUserId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function createUserWithPassword(input: {
  email: string;
  cpf: string;
  passwordHash: string;
  name: string;
  phone: string | null;
  /** Código de outro usuário (opcional). */
  inviteCodeEntered: string | null;
}): Promise<{ user: PublicUser; inviteInvalid: boolean }> {
  const pool = getPool();
  const displayName = input.name.trim().slice(0, 120);

  let referredByUserId: string | null = null;
  let inviteInvalid = false;
  if (input.inviteCodeEntered) {
    const refId = await findUserIdByReferralCode(input.inviteCodeEntered);
    if (refId) referredByUserId = refId;
    else inviteInvalid = true;
  }

  const myCode = await allocateUniqueReferralCode();

  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, cpf, password_hash, name, phone, referral_code, referred_by_user_id)
     VALUES (lower(trim($1)), $2, $3, trim($4), $5, $6, $7)
     RETURNING ${U}`,
    [
      input.email,
      input.cpf,
      input.passwordHash,
      displayName,
      input.phone,
      myCode,
      referredByUserId,
    ]
  );
  return { user: toPublic(rows[0]!), inviteInvalid };
}

export async function createUserFromGoogle(input: {
  email: string;
  googleSub: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  referredByUserId?: string | null;
}): Promise<PublicUser> {
  const pool = getPool();
  const verified = input.emailVerified ? new Date() : null;
  const emailLocal = input.email.split("@")[0]?.trim() || "Jogador";
  const displayName = (input.name?.trim() || emailLocal).slice(0, 120);
  const myCode = await allocateUniqueReferralCode();
  const referredBy =
    input.referredByUserId && input.referredByUserId.length > 0 ? input.referredByUserId : null;

  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, google_sub, name, avatar_url, email_verified_at, password_hash, cpf, referral_code, referred_by_user_id)
     VALUES (lower(trim($1)), $2, trim($3), $4, $5, NULL, NULL, $6, $7)
     RETURNING ${U}`,
    [input.email, input.googleSub, displayName, input.avatarUrl, verified, myCode, referredBy]
  );
  return toPublic(rows[0]!);
}

export async function linkGoogleToExistingUser(
  userId: string,
  googleSub: string,
  name: string | null,
  avatarUrl: string | null,
  emailVerified: boolean
): Promise<PublicUser> {
  const pool = getPool();
  const verified = emailVerified ? new Date() : null;
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET
       google_sub = $2,
       name = CASE WHEN $3 IS NOT NULL AND length(trim($3)) > 0 THEN trim($3) ELSE name END,
       avatar_url = CASE WHEN $4 IS NOT NULL AND $4 <> '' THEN $4 ELSE avatar_url END,
       email_verified_at = COALESCE(email_verified_at, $5::timestamptz),
       updated_at = now()
     WHERE id = $1
     RETURNING ${U}`,
    [userId, googleSub, name, avatarUrl, verified]
  );
  return toPublic(rows[0]!);
}
