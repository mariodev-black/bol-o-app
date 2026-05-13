/**
 * Configuração OAuth Google usada pelo app.
 * @see lib/google/README.md — passo a passo no Google Cloud Console.
 */
export const GOOGLE_OAUTH_SCOPES = "openid email profile" as const;

/** Path relativo à `APP_URL` para o redirect OAuth (deve estar cadastrado no Console). */
export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/auth/google/callback" as const;
