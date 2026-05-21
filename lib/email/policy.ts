/**
 * Política de canais transacionais
 *
 * CADASTRO — confirmação (código 6 dígitos)
 *   → Somente WhatsApp via SellFlux (`lib/auth/registration-sms.ts`)
 *   → Não usar Resend nesta etapa
 *
 * RESEND — apenas:
 *   1. Boas-vindas após `POST /api/auth/register` (`sendWelcomeEmail`)
 *   2. Recuperação de senha (`sendPasswordResetCodeEmail`)
 */

export const EMAIL_TAG_WELCOME = "welcome" as const;
export const EMAIL_TAG_PASSWORD_RESET = "password_reset" as const;

export type ResendEmailCategory = typeof EMAIL_TAG_WELCOME | typeof EMAIL_TAG_PASSWORD_RESET;
