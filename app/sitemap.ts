import type { MetadataRoute } from "next";
import { getMarketingOrigin } from "@/lib/seo/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getMarketingOrigin();
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/cadastrar`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  return routes;
}
