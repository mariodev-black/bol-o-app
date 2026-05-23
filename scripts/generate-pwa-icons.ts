/**
 * Gera/atualiza ícones PWA em public/pwa/.
 * Usa public/pwa/icon-512.png como mestre se existir; senão app/assets/logo-2.png.
 *
 * Uso: npm run pwa:icons
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
/** Mesmo valor de lib/pwa/icons.ts */
const PWA_BACKGROUND_COLOR = "#063D32";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/pwa");
const FALLBACK_SOURCE = path.join(ROOT, "app/assets/logo-2.png");
const MASTER_SOURCE = path.join(OUT_DIR, "icon-512.png");

const BG = {
  r: parseInt(PWA_BACKGROUND_COLOR.slice(1, 3), 16),
  g: parseInt(PWA_BACKGROUND_COLOR.slice(3, 5), 16),
  b: parseInt(PWA_BACKGROUND_COLOR.slice(5, 7), 16),
  alpha: 1,
} as const;

function resolveSource(): string {
  if (fs.existsSync(MASTER_SOURCE)) return MASTER_SOURCE;
  return FALLBACK_SOURCE;
}

async function resizeTo(size: number, filename: string, paddingRatio = 0) {
  const source = resolveSource();
  if (paddingRatio <= 0) {
    await sharp(source).resize(size, size, { fit: "cover" }).png().toFile(path.join(OUT_DIR, filename));
    console.log(`✓ public/pwa/${filename} (${size}×${size})`);
    return;
  }

  const inner = Math.round(size * (1 - paddingRatio * 2));
  const resized = await sharp(source)
    .resize(inner, inner, { fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const width = meta.width ?? inner;
  const height = meta.height ?? inner;
  const left = Math.round((size - width) / 2);
  const top = Math.round((size - height) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(path.join(OUT_DIR, filename));

  console.log(`✓ public/pwa/${filename} (${size}×${size})`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const master = resolveSource();
  console.log(`Fonte: ${path.relative(ROOT, master)}`);

  if (master !== path.join(OUT_DIR, "icon-512.png")) {
    await resizeTo(512, "icon-512.png", 0);
  }
  await resizeTo(192, "icon-192.png", 0);
  await resizeTo(180, "apple-touch-icon.png", 0);
  await resizeTo(512, "icon-maskable-512.png", 0.18);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
