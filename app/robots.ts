import type { MetadataRoute } from "next";
import { getAppOrigin, getMarketingOrigin } from "@/lib/seo/config";

export default function robots(): MetadataRoute.Robots {
  const marketing = getMarketingOrigin();
  const app = getAppOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/cadastrar", "/login"],
        disallow: [
          "/api/",
          "/admin/",
          "/boloes",
          "/tickets",
          "/ranking",
          "/palpites",
          "/meus-palpites",
          "/perfil",
          "/deposito",
          "/saques",
          "/dashboard",
          "/indique",
          "/premiacao",
        ],
      },
    ],
    sitemap: `${marketing}/sitemap.xml`,
    host: marketing,
  };
}
