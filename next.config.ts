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
  devIndicators: false,
};

export default nextConfig;
