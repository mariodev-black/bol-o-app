/**
 * Política de canais transacionais
 *
 * RESEND — e-mail transacional:
 *   1. Boas-vindas após `POST /api/auth/register` (`sendWelcomeEmail`)
 *   2. Recuperação de senha (`sendPasswordResetCodeEmail`)
 */

export const EMAIL_TAG_WELCOME = "welcome" as const;
export const EMAIL_TAG_PASSWORD_RESET = "password_reset" as const;
/** Campanha única: lembrete 17ª rodada Brasileirão (23/05/2026 09:12 BRT). */
export const EMAIL_TAG_CAMPAIGN_BRASILEIRAO_R17 = "campaign_brasileirao_r17" as const;
/** Disparo manual pelo painel admin (Notificações). */
export const EMAIL_TAG_ADMIN_BROADCAST = "admin_broadcast" as const;

export type ResendEmailCategory =
  | typeof EMAIL_TAG_WELCOME
  | typeof EMAIL_TAG_PASSWORD_RESET
  | typeof EMAIL_TAG_CAMPAIGN_BRASILEIRAO_R17
  | typeof EMAIL_TAG_ADMIN_BROADCAST;
