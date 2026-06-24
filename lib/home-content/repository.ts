import { getPool } from "@/lib/db";
import { ensureHomeContentSchema } from "@/lib/home-content/schema";
import type {
  HomeBanner,
  HomeBannerInput,
  HomeBolaoCard,
  HomeBolaoCardInput,
} from "@/lib/home-content/types";

// ── Banners ───────────────────────────────────────────────────

type BannerRow = {
  id: string;
  alt: string;
  href: string;
  has_image: boolean;
  sort_order: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

function mapBanner(r: BannerRow): HomeBanner {
  return {
    id: r.id,
    alt: r.alt ?? "",
    href: r.href ?? "",
    hasImage: Boolean(r.has_image),
    imageUrl: r.has_image ? `/api/public/home-banner/${r.id}` : null,
    sortOrder: Number(r.sort_order) || 0,
    enabled: Boolean(r.enabled),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const BANNER_COLS = `id, alt, href, (image_data IS NOT NULL) AS has_image,
  sort_order, enabled, created_at, updated_at`;

export async function listHomeBanners(opts?: {
  includeDisabled?: boolean;
}): Promise<HomeBanner[]> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rows } = await pool.query<BannerRow>(
    `SELECT ${BANNER_COLS} FROM home_banners
      ${opts?.includeDisabled ? "" : "WHERE enabled = true"}
      ORDER BY sort_order ASC, created_at ASC`,
  );
  return rows.map(mapBanner);
}

export async function getHomeBannerById(id: string): Promise<HomeBanner | null> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rows } = await pool.query<BannerRow>(
    `SELECT ${BANNER_COLS} FROM home_banners WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapBanner(rows[0]) : null;
}

export async function createHomeBanner(input: HomeBannerInput): Promise<HomeBanner> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rows } = await pool.query<BannerRow>(
    `INSERT INTO home_banners (alt, href, sort_order, enabled)
     VALUES ($1, $2, $3, $4)
     RETURNING ${BANNER_COLS}`,
    [
      input.alt ?? "",
      input.href ?? "",
      Number.isFinite(input.sortOrder) ? Math.trunc(Number(input.sortOrder)) : 0,
      input.enabled ?? true,
    ],
  );
  return mapBanner(rows[0]!);
}

export async function updateHomeBanner(
  id: string,
  input: HomeBannerInput,
): Promise<HomeBanner | null> {
  await ensureHomeContentSchema();
  const pool = getPool();
  // COALESCE: só atualiza o que veio no input (campos undefined ficam como estão).
  const { rows } = await pool.query<BannerRow>(
    `UPDATE home_banners SET
       alt = COALESCE($2, alt),
       href = COALESCE($3, href),
       sort_order = COALESCE($4, sort_order),
       enabled = COALESCE($5, enabled),
       updated_at = now()
     WHERE id = $1
     RETURNING ${BANNER_COLS}`,
    [
      id,
      input.alt ?? null,
      input.href ?? null,
      input.sortOrder ?? null,
      input.enabled ?? null,
    ],
  );
  return rows[0] ? mapBanner(rows[0]) : null;
}

/** Remove definitivamente um banner (conteúdo de marketing, não dado de usuário). */
export async function deleteHomeBanner(id: string): Promise<boolean> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rowCount } = await pool.query(`DELETE FROM home_banners WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function setHomeBannerImage(
  id: string,
  data: Buffer,
  mime: string,
): Promise<boolean> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE home_banners SET image_data = $2::bytea, image_mime = $3, updated_at = now()
     WHERE id = $1`,
    [id, data, mime],
  );
  return (rowCount ?? 0) > 0;
}

export async function readHomeBannerImage(
  id: string,
): Promise<{ data: Buffer; mime: string } | null> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rows } = await pool.query<{ image_data: Buffer | null; image_mime: string | null }>(
    `SELECT image_data, image_mime FROM home_banners WHERE id = $1 LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row?.image_data) return null;
  return { data: row.image_data, mime: row.image_mime || "image/png" };
}

// ── Cards de bolão ────────────────────────────────────────────

type CardRow = {
  id: string;
  name: string;
  badge: string | null;
  badge_variant: string | null;
  date_text: string | null;
  time_text: string | null;
  prize_label: string | null;
  prize_unit: string | null;
  href: string;
  is_primary: boolean;
  has_image: boolean;
  sort_order: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

function mapCard(r: CardRow): HomeBolaoCard {
  return {
    id: r.id,
    name: r.name ?? "",
    badge: r.badge,
    badgeVariant: r.badge_variant === "primary" ? "primary" : "muted",
    dateText: r.date_text,
    timeText: r.time_text,
    prizeLabel: r.prize_label,
    prizeUnit: r.prize_unit,
    href: r.href ?? "",
    isPrimary: Boolean(r.is_primary),
    hasImage: Boolean(r.has_image),
    imageUrl: r.has_image ? `/api/public/home-bolao-card/${r.id}` : null,
    sortOrder: Number(r.sort_order) || 0,
    enabled: Boolean(r.enabled),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const CARD_COLS = `id, name, badge, badge_variant, date_text, time_text,
  prize_label, prize_unit, href, is_primary, (image_data IS NOT NULL) AS has_image,
  sort_order, enabled, created_at, updated_at`;

export async function listHomeBolaoCards(opts?: {
  includeDisabled?: boolean;
}): Promise<HomeBolaoCard[]> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rows } = await pool.query<CardRow>(
    `SELECT ${CARD_COLS} FROM home_bolao_cards
      ${opts?.includeDisabled ? "" : "WHERE enabled = true"}
      ORDER BY sort_order ASC, created_at ASC`,
  );
  return rows.map(mapCard);
}

export async function getHomeBolaoCardById(id: string): Promise<HomeBolaoCard | null> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rows } = await pool.query<CardRow>(
    `SELECT ${CARD_COLS} FROM home_bolao_cards WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapCard(rows[0]) : null;
}

export async function createHomeBolaoCard(
  input: HomeBolaoCardInput,
): Promise<HomeBolaoCard> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rows } = await pool.query<CardRow>(
    `INSERT INTO home_bolao_cards
       (name, badge, badge_variant, date_text, time_text, prize_label, prize_unit,
        href, is_primary, sort_order, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${CARD_COLS}`,
    [
      input.name ?? "",
      input.badge ?? null,
      input.badgeVariant === "primary" ? "primary" : "muted",
      input.dateText ?? null,
      input.timeText ?? null,
      input.prizeLabel ?? null,
      input.prizeUnit ?? null,
      input.href ?? "",
      input.isPrimary ?? false,
      Number.isFinite(input.sortOrder) ? Math.trunc(Number(input.sortOrder)) : 0,
      input.enabled ?? true,
    ],
  );
  return mapCard(rows[0]!);
}

export async function updateHomeBolaoCard(
  id: string,
  input: HomeBolaoCardInput,
): Promise<HomeBolaoCard | null> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rows } = await pool.query<CardRow>(
    `UPDATE home_bolao_cards SET
       name = COALESCE($2, name),
       badge = COALESCE($3, badge),
       badge_variant = COALESCE($4, badge_variant),
       date_text = COALESCE($5, date_text),
       time_text = COALESCE($6, time_text),
       prize_label = COALESCE($7, prize_label),
       prize_unit = COALESCE($8, prize_unit),
       href = COALESCE($9, href),
       is_primary = COALESCE($10, is_primary),
       sort_order = COALESCE($11, sort_order),
       enabled = COALESCE($12, enabled),
       updated_at = now()
     WHERE id = $1
     RETURNING ${CARD_COLS}`,
    [
      id,
      input.name ?? null,
      input.badge === undefined ? null : input.badge,
      input.badgeVariant ?? null,
      input.dateText === undefined ? null : input.dateText,
      input.timeText === undefined ? null : input.timeText,
      input.prizeLabel === undefined ? null : input.prizeLabel,
      input.prizeUnit === undefined ? null : input.prizeUnit,
      input.href ?? null,
      input.isPrimary ?? null,
      input.sortOrder ?? null,
      input.enabled ?? null,
    ],
  );
  return rows[0] ? mapCard(rows[0]) : null;
}

export async function deleteHomeBolaoCard(id: string): Promise<boolean> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rowCount } = await pool.query(`DELETE FROM home_bolao_cards WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function setHomeBolaoCardImage(
  id: string,
  data: Buffer,
  mime: string,
): Promise<boolean> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE home_bolao_cards SET image_data = $2::bytea, image_mime = $3, updated_at = now()
     WHERE id = $1`,
    [id, data, mime],
  );
  return (rowCount ?? 0) > 0;
}

export async function readHomeBolaoCardImage(
  id: string,
): Promise<{ data: Buffer; mime: string } | null> {
  await ensureHomeContentSchema();
  const pool = getPool();
  const { rows } = await pool.query<{ image_data: Buffer | null; image_mime: string | null }>(
    `SELECT image_data, image_mime FROM home_bolao_cards WHERE id = $1 LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row?.image_data) return null;
  return { data: row.image_data, mime: row.image_mime || "image/png" };
}
