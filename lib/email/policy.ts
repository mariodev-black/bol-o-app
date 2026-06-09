export const EMAIL_TAG_WELCOME = "welcome" as const;
export const EMAIL_TAG_PASSWORD_RESET = "password_reset" as const;
/** Campanha única: lembrete 17ª rodada Brasileirão (23/05/2026 09:12 BRT). */
export const EMAIL_TAG_CAMPAIGN_BRASILEIRAO_R17 = "campaign_brasileirao_r17" as const;
/** Campanha sequencial: Copa 2026 — 12 disparos Ter/Qua/Qui (10–12/06/2026). */
export const EMAIL_TAG_CAMPAIGN_COPA_BOLAO = "campaign_copa_bolao_2026" as const;
/** Disparo manual pelo painel admin (Notificações). */
export const EMAIL_TAG_ADMIN_BROADCAST = "admin_broadcast" as const;

export type ResendEmailCategory =
  | typeof EMAIL_TAG_WELCOME
  | typeof EMAIL_TAG_PASSWORD_RESET
  | typeof EMAIL_TAG_CAMPAIGN_BRASILEIRAO_R17
  | typeof EMAIL_TAG_CAMPAIGN_COPA_BOLAO
  | typeof EMAIL_TAG_ADMIN_BROADCAST;
