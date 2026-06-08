import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/promo/brasil-marrocos",
        destination: "/",
        permanent: true,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "55mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.api-futebol.com.br",
      },
    ],
    // Qualidades aceitas pelo otimizador. `75` é o default; adicionamos `90` e
    // `100` para banners de marca (login/cadastro) que precisam de nitidez.
    qualities: [75, 90, 100],
    // AVIF tem melhor compressão sem perda perceptível; WebP é fallback.
    formats: ["image/avif", "image/webp"],
  },
  devIndicators: false,
};

export default nextConfig;
