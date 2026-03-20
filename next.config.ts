import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.api-futebol.com.br",
      },
    ],
  },
};

export default nextConfig;
