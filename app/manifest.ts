import type { MetadataRoute } from "next";
import { getMarketingOrigin, SITE_NAME, SITE_TAGLINE } from "@/lib/seo/config";

export default function manifest(): MetadataRoute.Manifest {
  const origin = getMarketingOrigin();

  return {
    name: SITE_NAME,
    short_name: "Bolão Milhão",
    description: SITE_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#B1EB0B",
    lang: "pt-BR",
    orientation: "portrait",
    categories: ["sports", "entertainment"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
    id: origin,
  };
}
