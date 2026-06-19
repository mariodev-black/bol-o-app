/** localStorage: valor "1" = usuário fechou o banner de instalar app */
export const INSTALL_BANNER_STORAGE_KEY = "bolao_install_banner_dismissed";

export const INSTALL_BANNER_HEIGHT_PX = 52;
export const HEADER_MAIN_HEIGHT_MOBILE_PX = 55;
export const HEADER_MAIN_HEIGHT_DESKTOP_PX = 64;

export function readInstallBannerDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INSTALL_BANNER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistInstallBannerDismissed(): void {
  try {
    window.localStorage.setItem(INSTALL_BANNER_STORAGE_KEY, "1");
  } catch {
    /* quota / modo privado */
  }
}

export type InstallSheetPlatform = "ios" | "android";

export function detectInstallSheetPlatform(): InstallSheetPlatform {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent;
  const isIos =
    /iphone|ipad|ipod/i.test(ua) &&
    !(typeof window !== "undefined" &&
      (window as Window & { MSStream?: unknown }).MSStream);
  return isIos ? "ios" : "android";
}

export function getInstallSiteHost(): string {
  if (typeof window === "undefined") return "bolaodomilhao.com.br";
  return window.location.host || "bolaodomilhao.com.br";
}

export function syncAppHeaderHeightCss(
  installBannerVisible: boolean,
  mainHeaderPx: number = HEADER_MAIN_HEIGHT_MOBILE_PX,
): void {
  const bannerPx = installBannerVisible ? INSTALL_BANNER_HEIGHT_PX : 0;
  const root = document.documentElement;
  root.style.setProperty("--app-header-banner-height", `${bannerPx}px`);
  root.style.setProperty("--app-header-main-height", `${mainHeaderPx}px`);
  root.style.setProperty(
    "--app-header-height",
    `${mainHeaderPx + bannerPx}px`,
  );
}
