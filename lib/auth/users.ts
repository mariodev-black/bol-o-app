import { getPool } from "@/lib/db";
import { allocateUniqueReferralCode, findUserIdByReferralCode } from "@/lib/auth/referral-code";
import { clampAvatarIndex, randomPresetAvatarIndex } from "@/lib/auth/avatar-index";
import { isValidCpf, normalizeCpf } from "@/lib/auth/cpf";
import { isStoredAvatarUploadFilename } from "@/lib/user/avatar-filename";
import { deleteUserAvatarFile, newRandomAvatarFilename, assertAvatarUploadBuffer } from "@/lib/user/avatar-upload-storage";
import { fetchPictureAsBuffer } from "@/lib/google/fetch-picture-as-buffer";

const U =
  "id, email, cpf, password_hash, name, phone, avatar_url, avatar_index, avatar_upload_filename, google_sub, email_verified_at, referral_code, referred_by_user_id";

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  /** Preset local 0–4 (`app/assets/avatares/{n}.png`). */
  avatarIndex: number;
  /** Basename estável (UUID + ext.); bytes em `avatar_upload_data` ou legado em `public/avataruploads/`. */
  avatarUploadFilename: string | null;
  referralCode: string;
  /**
   * Contas Google (`google_sub`) precisam informar CPF no app; contas só senha seguem como completas.
   */
  profileComplete: boolean;
};

type UserRow = {
  id: string;
  email: string;
  cpf: string | null;
  password_hash: string | null;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  avatar_index: string | number | null;
  avatar_upload_filename: string | null;
  google_sub: string | null;
  email_verified_at: Date | null;
  referral_code: string | null;
  referred_by_user_id: string | null;
};

function rowAvatarIndex(row: UserRow): number {
  const v = row.avatar_index;
  if (typeof v === "number" && Number.isFinite(v)) return clampAvatarIndex(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return clampAvatarIndex(n);
  }
  return 0;
}

function rowAvatarUploadFilename(row: UserRow): string | null {
  const v = row.avatar_upload_filename?.trim();
  if (!v) return null;
  return isStoredAvatarUploadFilename(v) ? v : null;
}

function computeProfileComplete(row: UserRow): boolean {
  if (!row.google_sub) return true;
  const nameOk = (row.name?.trim().length ?? 0) >= 2;
  const cpfOk = row.cpf != null && isValidCpf(normalizeCpf(row.cpf));
  return nameOk && cpfOk;
}

function toPublic(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    avatarIndex: rowAvatarIndex(row),
    avatarUploadFilename: rowAvatarUploadFilename(row),
    referralCode: row.referral_code ?? "",
    profileComplete: computeProfileComplete(row),
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

  const avatarIndex = randomPresetAvatarIndex();

  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, cpf, password_hash, name, phone, referral_code, referred_by_user_id, avatar_index)
     VALUES (lower(trim($1)), $2, $3, trim($4), $5, $6, $7, $8)
     RETURNING ${U}`,
    [
      input.email,
      input.cpf,
      input.passwordHash,
      displayName,
      input.phone,
      myCode,
      referredByUserId,
      avatarIndex,
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
  const avatarIndex = randomPresetAvatarIndex();

  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, google_sub, name, avatar_url, avatar_index, email_verified_at, password_hash, cpf, referral_code, referred_by_user_id)
     VALUES (lower(trim($1)), $2, trim($3), $4, $5, $6, NULL, NULL, $7, $8)
     RETURNING ${U}`,
    [input.email, input.googleSub, displayName, input.avatarUrl, avatarIndex, verified, myCode, referredBy]
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

/** Atualiza nome/foto do Google em logins recorrentes (conta já existente por `google_sub`). */
export async function syncGoogleProfileFields(
  userId: string,
  name: string | null,
  avatarUrl: string | null,
  emailVerified: boolean
): Promise<void> {
  const pool = getPool();
  const verified = emailVerified ? new Date() : null;
  await pool.query(
    `UPDATE users SET
       name = CASE WHEN $2::text IS NOT NULL AND length(trim($2::text)) > 0 THEN trim($2::text) ELSE name END,
       avatar_url = CASE WHEN $3::text IS NOT NULL AND $3::text <> '' THEN $3 ELSE avatar_url END,
       email_verified_at = COALESCE(email_verified_at, $4::timestamptz),
       updated_at = now()
     WHERE id = $1`,
    [userId, name, avatarUrl, verified]
  );
}

async function isCpfTakenByOtherUser(cpf11: string, exceptUserId: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM users WHERE cpf = $1 AND id <> $2::uuid) AS ok`,
    [cpf11, exceptUserId]
  );
  return Boolean(rows[0]?.ok);
}

/**
 * Primeiro preenchimento de CPF (e telefone opcional) para quem entrou com Google.
 */
export async function completeGoogleProfile(input: {
  userId: string;
  cpf: string;
  phone: string | null;
  fullName: string | null;
}): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const cpfNorm = normalizeCpf(input.cpf);
  if (!isValidCpf(cpfNorm)) return { ok: false, error: "CPF inválido" };

  const pool = getPool();
  const { rows: before } = await pool.query<UserRow>(`SELECT ${U} FROM users WHERE id = $1 LIMIT 1`, [
    input.userId,
  ]);
  const row = before[0];
  if (!row) return { ok: false, error: "Usuário não encontrado" };
  if (!row.google_sub) {
    return { ok: false, error: "Esta ação é só para contas que entraram com Google." };
  }
  if (row.cpf != null && isValidCpf(normalizeCpf(row.cpf))) {
    return { ok: true, user: toPublic(row) };
  }

  const taken = await isCpfTakenByOtherUser(cpfNorm, input.userId);
  if (taken) return { ok: false, error: "Este CPF já está cadastrado em outra conta." };

  const phoneTrim = input.phone?.trim() ?? "";
  const phoneVal = phoneTrim.length > 0 ? phoneTrim.slice(0, 40) : null;

  const fn = input.fullName?.trim() ?? "";
  const nameParam = fn.length >= 2 ? fn.slice(0, 120) : null;

  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET
       cpf = $2,
       phone = COALESCE($3, phone),
       name = CASE WHEN $4::text IS NOT NULL AND length(trim($4::text)) >= 2 THEN trim($4::text) ELSE name END,
       updated_at = now()
     WHERE id = $1::uuid AND google_sub IS NOT NULL AND cpf IS NULL
     RETURNING ${U}`,
    [input.userId, cpfNorm, phoneVal, nameParam]
  );
  const updated = rows[0];
  if (!updated) {
    const again = await findUserById(input.userId);
    if (again?.profileComplete) return { ok: true, user: again };
    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
  return { ok: true, user: toPublic(updated) };
}

export async function updateUserAvatarIndex(userId: string, avatarIndex: number): Promise<PublicUser | null> {
  const idx = clampAvatarIndex(avatarIndex);
  const pool = getPool();
  const { rows: peekRows } = await pool.query<{ f: string | null }>(
    `SELECT avatar_upload_filename AS f FROM users WHERE id = $1`,
    [userId]
  );
  const oldUpload = peekRows[0]?.f?.trim() ?? null;

  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET avatar_index = $2, avatar_upload_filename = NULL, avatar_upload_data = NULL, updated_at = now() WHERE id = $1 RETURNING ${U}`,
    [userId, idx]
  );
  const row = rows[0];
  if (!row) return null;
  if (oldUpload && isStoredAvatarUploadFilename(oldUpload)) {
    deleteUserAvatarFile(oldUpload);
  }
  return toPublic(row);
}

export async function setUserAvatarUploadFromBuffer(
  userId: string,
  buf: Buffer,
  mimeRaw: string
): Promise<PublicUser | null> {
  const { ext } = assertAvatarUploadBuffer(buf, mimeRaw);
  const pool = getPool();
  const { rows: peekRows } = await pool.query<{ f: string | null }>(
    `SELECT avatar_upload_filename AS f FROM users WHERE id = $1`,
    [userId]
  );
  const oldUpload = peekRows[0]?.f?.trim() ?? null;
  const newName = newRandomAvatarFilename(ext);

  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET avatar_upload_filename = $2, avatar_upload_data = $3::bytea, updated_at = now() WHERE id = $1 RETURNING ${U}`,
    [userId, newName, buf]
  );
  const row = rows[0];
  if (!row) return null;
  if (oldUpload && isStoredAvatarUploadFilename(oldUpload) && oldUpload !== newName) {
    deleteUserAvatarFile(oldUpload);
  }
  return toPublic(row);
}

/**
 * Baixa a URL `picture` do Google e grava em `avatar_upload_*` (ranking/perfil usam esse pipeline).
 * Não substitui se o usuário já tem upload customizado.
 */
export async function tryPersistGooglePictureAsAvatarUpload(
  userId: string,
  pictureUrl: string | null
): Promise<void> {
  const url = pictureUrl?.trim() ?? "";
  if (!url) return;
  const pool = getPool();
  const { rows: peek } = await pool.query<{ f: string | null }>(
    `SELECT avatar_upload_filename AS f FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const existing = peek[0]?.f?.trim() ?? null;
  if (existing && isStoredAvatarUploadFilename(existing)) return;

  const got = await fetchPictureAsBuffer(url);
  if (!got) return;
  try {
    await setUserAvatarUploadFromBuffer(userId, got.buffer, got.mime);
  } catch (e) {
    console.warn("[tryPersistGooglePictureAsAvatarUpload]", e);
  }
}

export async function clearUserAvatarUpload(userId: string): Promise<PublicUser | null> {
  const pool = getPool();
  const { rows: peekRows } = await pool.query<{ f: string | null }>(
    `SELECT avatar_upload_filename AS f FROM users WHERE id = $1`,
    [userId]
  );
  const oldUpload = peekRows[0]?.f?.trim() ?? null;

  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET avatar_upload_filename = NULL, avatar_upload_data = NULL, updated_at = now() WHERE id = $1 RETURNING ${U}`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  if (oldUpload && isStoredAvatarUploadFilename(oldUpload)) {
    deleteUserAvatarFile(oldUpload);
  }
  return toPublic(row);
}

export async function getUserPasswordHashById(userId: string): Promise<{ password_hash: string | null } | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ password_hash: string | null }>(
    `SELECT password_hash FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function updateUserPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
  const pool = getPool();
  const r = await pool.query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
    userId,
    passwordHash,
  ]);
  return (r.rowCount ?? 0) > 0;
}
