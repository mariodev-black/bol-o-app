/**
 * Gera par de chaves VAPID para Web Push.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/generate-vapid-keys.ts
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.info("Adicione ao .env:\n");
console.info(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.info(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.info(`VAPID_SUBJECT=mailto:contato@bolaodomilhao.com.br`);
