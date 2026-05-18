/** Host + sessão resolvidos no servidor (evita flash da LP no SSR/hidratação). */
export type HomePageServerHint = {
  onApp: boolean;
  onMarketing: boolean;
  initialLoggedIn: boolean;
};
