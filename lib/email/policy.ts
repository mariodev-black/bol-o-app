export const EMAIL_TAG_WELCOME = "welcome" as const;
export const EMAIL_TAG_PASSWORD_RESET = "password_reset" as const;
/** Campanha única: lembrete 17ª rodada Brasileirão (23/05/2026 09:12 BRT). */
export const EMAIL_TAG_CAMPAIGN_BRASILEIRAO_R17 = "campaign_brasileirao_r17" as const;
/** Campanha sequencial: Copa 2026 — 12 disparos Ter/Qua/Qui (10–12/06/2026). */
export const EMAIL_TAG_CAMPAIGN_COPA_BOLAO = "campaign_copa_bolao_2026" as const;
/** Recuperação de PIX abandonado — Copa 2026 (8 steps, 15min→72h). */
export const EMAIL_TAG_PIX_RECOVERY_COPA = "pix_recovery_copa_2026" as const;
/** CRM pós-compra: upsell de múltiplas cotas (3 e-mails, 2h/24h/48h). */
export const EMAIL_TAG_POS_COMPRA_UPSELL = "pos_compra_upsell" as const;
/** CRM prova social para cadastrados sem compra (4 e-mails). */
export const EMAIL_TAG_PROVA_SOCIAL = "prova_social" as const;
/** CRM pós-compra: indique e ganhe (3 e-mails). */
export const EMAIL_TAG_COMPROU_INDIQUE = "comprou_indique" as const;
/** CRM oferta de indicação para toda a base (6 e-mails, broadcast sequencial). */
export const EMAIL_TAG_INDIQUE_OFERTA = "indique_oferta" as const;
/** CRM recuperação de checkout — cadastrado sem compra (3 e-mails). */
export const EMAIL_TAG_CHECKOUT_RECOVERY = "checkout_recovery" as const;
/** Disparo manual pelo painel admin (Notificações). */
export const EMAIL_TAG_ADMIN_BROADCAST = "admin_broadcast" as const;

export type ResendEmailCategory =
  | typeof EMAIL_TAG_WELCOME
  | typeof EMAIL_TAG_PASSWORD_RESET
  | typeof EMAIL_TAG_CAMPAIGN_BRASILEIRAO_R17
  | typeof EMAIL_TAG_CAMPAIGN_COPA_BOLAO
  | typeof EMAIL_TAG_PIX_RECOVERY_COPA
  | typeof EMAIL_TAG_POS_COMPRA_UPSELL
  | typeof EMAIL_TAG_PROVA_SOCIAL
  | typeof EMAIL_TAG_COMPROU_INDIQUE
  | typeof EMAIL_TAG_INDIQUE_OFERTA
  | typeof EMAIL_TAG_CHECKOUT_RECOVERY
  | typeof EMAIL_TAG_ADMIN_BROADCAST;
