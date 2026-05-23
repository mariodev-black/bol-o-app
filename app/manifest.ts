import type { MetadataRoute } from "next";
import { PWA_START_PATH } from "@/lib/pwa/config";
import {
  PWA_BACKGROUND_COLOR,
  PWA_ICON_PATHS,
  PWA_THEME_COLOR,
} from "@/lib/pwa/icons";
import { getAppOrigin, SITE_NAME, SITE_TAGLINE } from "@/lib/seo/config";

export default function manifest(): MetadataRoute.Manifest {
  const origin = getAppOrigin();

  return {
    name: SITE_NAME,
    short_name: "Bolão Milhão",
    description: SITE_TAGLINE,
    start_url: PWA_START_PATH,
    scope: "/",
    id: `${origin}/`,
    display: "standalone",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    lang: "pt-BR",
    dir: "ltr",
    orientation: "portrait",
    categories: ["sports", "entertainment"],
    prefer_related_applications: false,
    icons: [
      {
        src: PWA_ICON_PATHS.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: PWA_ICON_PATHS.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: PWA_ICON_PATHS.appleTouch,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: PWA_ICON_PATHS.maskable512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [],
    related_applications: [],
  };
}
