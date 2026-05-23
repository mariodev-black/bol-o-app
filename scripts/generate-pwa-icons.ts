/**
 * Gera ícones PWA em public/pwa/ a partir de app/assets/logo-2.png (logoApp).
 * Uso: npm run pwa:icons
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "app/assets/logo-2.png");
const OUT_DIR = path.join(ROOT, "public/pwa");

/** Padding em cada lado (0.12 ≈ logo ocupa ~76% do quadrado; ok para maskable). */
const PADDING_RATIO = 0.12;
const BG = { r: 0, g: 0, b: 0, alpha: 1 } as const;

async function writeSquareIcon(size: number, filename: string) {
  const inner = Math.round(size * (1 - PADDING_RATIO * 2));
  const resized = await sharp(SOURCE)
    .resize(inner, inner, { fit: "inside" })
    .png()
    .toBuffer();

  const { width = inner, height = inner } = await sharp(resized).metadata();
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
  await writeSquareIcon(192, "icon-192.png");
  await writeSquareIcon(512, "icon-512.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
