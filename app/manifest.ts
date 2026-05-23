import type { MetadataRoute } from "next";
import { PWA_START_PATH } from "@/lib/pwa/config";
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
    background_color: "#000000",
    theme_color: "#B1EB0B",
    lang: "pt-BR",
    dir: "ltr",
    orientation: "portrait",
    categories: ["sports", "entertainment"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [],
    related_applications: [],
  };
}
