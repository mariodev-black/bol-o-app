import { getPool } from "@/lib/db";

/** Tempo após o cadastro para disparar a notificação promocional do bolão. */
export const BOLAO_PROMO_DELAY_MS = 10 * 60 * 1000;

export type UserNotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  preview: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type UserNotificationDto = {
  id: string;
  kind: string;
  title: string;
  preview: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  unread: boolean;
};

function toDto(row: UserNotificationRow): UserNotificationDto {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    preview: row.preview,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
    unread: row.read_at == null,
  };
}

function welcomeCopy(name?: string | null): {
  title: string;
  preview: string;
  body: string;
} {
  const first = (name ?? "").trim().split(/\s+/)[0];
  const hi = first ? `${first}, ` : "";
  return {
    title: "Bem-vindo ao Bolão do Milhão",
    preview: `${hi}sua conta está pronta. Comece a dar seus palpites na Copa 2026.`,
    body: `${hi}bem-vindo ao Bolão do Milhão.

Sua conta foi criada com sucesso. A partir de agora você pode comprar tickets, registrar palpites nos jogos e acompanhar sua posição no ranking em tempo real.

Próximos passos:
1. Garanta seu ticket na Copa 2026
2. Envie seus palpites antes do apito de cada jogo
3. Acompanhe pontos e premiações no app

Boa sorte — e que os melhores palpites sejam os seus!`,
  };
}

function bolaoPromoCopy(name?: string | null): {
  title: string;
  preview: string;
  body: string;
} {
  const first = (name ?? "").trim().split(/\s+/)[0];
  const hi = first ? `${first}, ` : "";
  return {
    title: "R$ 1 MILHÃO em prêmios — não fique de fora",
    preview: `${hi}Top 10 do ranking leva premiação pesada. Garanta sua cota por R$ 39,90 AGORA.`,
    body: `${hi}chegou a hora de jogar sério no Bolão do Milhão.

Mais de R$ 1.000.000,00 em prêmios estão em disputa na Copa 2026 — e os 10 primeiros do ranking levam fatias que podem mudar sua vida. Não é sorteio de loteria: é palpite certo, consistência e posição no ranking.

O que você perde ficando de fora:
• Concorrer ao pool milionário do bolão geral
• Subir no ranking ao vivo a cada jogo
• Premiação diária para quem performa no dia

Sua cota custa só R$ 39,90. Um palpite bem colocado pode valer muito mais do que o ticket.

Abra Bolões, garanta sua vaga e envie seus palpites antes do apito. Quem entra tarde só assiste os outros subirem.`,
  };
}

/** Remove duplicatas de kinds fixos (mantém a mais antiga). */
export async function pruneDuplicateNotifications(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `DELETE FROM user_notifications a
     USING user_notifications b
     WHERE a.user_id = $1
       AND b.user_id = $1
       AND a.kind = b.kind
       AND a.kind IN ('welcome', 'bolao_promo')
       AND a.id <> b.id
       AND a.created_at > b.created_at`,
    [userId],
  );
}

/** Uma notificação de boas-vindas por usuário (idempotente). */
export async function ensureWelcomeNotification(
  userId: string,
  name?: string | null,
): Promise<void> {
  const pool = getPool();
  const { title, preview, body } = welcomeCopy(name);
  await pool.query(
    `INSERT INTO user_notifications (user_id, kind, title, preview, body)
     VALUES ($1, 'welcome', $2, $3, $4)
     ON CONFLICT (user_id, kind) WHERE (kind = 'welcome') DO NOTHING`,
    [userId, title, preview, body],
  );
}

/** Promo do bolão: uma por usuário, só após 10 min do cadastro (idempotente). */
export async function ensureBolaoPromoNotification(
  userId: string,
  userCreatedAt: Date,
  name?: string | null,
): Promise<void> {
  const elapsedMs = Date.now() - userCreatedAt.getTime();
  if (elapsedMs < BOLAO_PROMO_DELAY_MS) return;

  const pool = getPool();
  const { title, preview, body } = bolaoPromoCopy(name);
  await pool.query(
    `INSERT INTO user_notifications (user_id, kind, title, preview, body)
     VALUES ($1, 'bolao_promo', $2, $3, $4)
     ON CONFLICT (user_id, kind) WHERE (kind = 'bolao_promo') DO NOTHING`,
    [userId, title, preview, body],
  );
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM user_notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return Number.parseInt(rows[0]?.n ?? "0", 10) || 0;
}

export async function listUserNotifications(
  userId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ items: UserNotificationDto[]; total: number }> {
  const pool = getPool();
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  const offset = Math.max(opts?.offset ?? 0, 0);

  const [listRes, countRes] = await Promise.all([
    pool.query<UserNotificationRow>(
      `SELECT id, user_id, kind, title, preview, body, read_at, created_at
       FROM user_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
    pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM user_notifications WHERE user_id = $1`,
      [userId],
    ),
  ]);

  const total = Number.parseInt(countRes.rows[0]?.n ?? "0", 10) || 0;
  return {
    items: listRes.rows.map(toDto),
    total,
  };
}

export async function getUserNotification(
  userId: string,
  notificationId: string,
): Promise<UserNotificationDto | null> {
  const pool = getPool();
  const { rows } = await pool.query<UserNotificationRow>(
    `SELECT id, user_id, kind, title, preview, body, read_at, created_at
     FROM user_notifications
     WHERE user_id = $1 AND id = $2`,
    [userId, notificationId],
  );
  const row = rows[0];
  return row ? toDto(row) : null;
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<UserNotificationDto | null> {
  const pool = getPool();
  const { rows } = await pool.query<UserNotificationRow>(
    `UPDATE user_notifications
     SET read_at = COALESCE(read_at, now())
     WHERE user_id = $1 AND id = $2
     RETURNING id, user_id, kind, title, preview, body, read_at, created_at`,
    [userId, notificationId],
  );
  const row = rows[0];
  return row ? toDto(row) : null;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE user_notifications SET read_at = now()
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return rowCount ?? 0;
}
