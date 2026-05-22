/**
 * Política de canais transacionais
 *
 * RESEND — e-mail transacional:
 *   1. Boas-vindas após `POST /api/auth/register` (`sendWelcomeEmail`)
 *   2. Recuperação de senha (`sendPasswordResetCodeEmail`)
 */

export const EMAIL_TAG_WELCOME = "welcome" as const;
export const EMAIL_TAG_PASSWORD_RESET = "password_reset" as const;

export type ResendEmailCategory = typeof EMAIL_TAG_WELCOME | typeof EMAIL_TAG_PASSWORD_RESET;
