export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  /** Preset 0–4 (`app/assets/avatares/{n}.png`), persistido em `users.avatar_index`. */
  avatarIndex: number;
  /** Basename estável (UUID + ext.); bytes em `users.avatar_upload_data` ou legado em `public/avataruploads/`. */
  avatarUploadFilename: string | null;
  /** Código de indicação deste usuário (para compartilhar). */
  referralCode: string;
  /** Contas Google sem CPF ainda: `false` até completar o cadastro no modal. */
  profileComplete: boolean;
  /** Funil Skale ativo — bloqueia promoções e rotas até comprar cota. */
  skaleFunnelLocked?: boolean;
};
