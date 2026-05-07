import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  return bits
    .match(/.{1,5}/g)!
    .map((chunk) => BASE32_ALPHABET[parseInt(chunk.padEnd(5, "0"), 2)])
    .join("");
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value < 0) throw new Error("Secret 2FA invalido");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g)?.map((byte) => parseInt(byte, 2)) ?? [];
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function buildOtpAuthUrl(input: { secret: string; email: string; issuer?: string }): string {
  const issuer = input.issuer ?? "Bolao do Milhao Admin";
  const label = `${issuer}:${input.email}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function verifyTotpCode(secret: string, code: string, window = 1): boolean {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const current = Math.floor(Date.now() / 1000 / 30);
  const received = Buffer.from(clean);
  for (let drift = -window; drift <= window; drift++) {
    const expected = Buffer.from(hotp(secret, current + drift));
    if (expected.length === received.length && timingSafeEqual(expected, received)) return true;
  }
  return false;
}
