import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo/config";

export const alt =
  "Bolão do Milhão — Bolão da Copa 2026 com mais de R$ 1 milhão em prêmios";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          background: "linear-gradient(145deg, #0a0a0a 0%, #1a2208 45%, #0a0a0a 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: "#B1EB0B",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Copa do Mundo 2026
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 32,
            fontWeight: 600,
            color: "rgba(255,255,255,0.88)",
            maxWidth: 900,
          }}
        >
          Bolão da Copa · Palpites · Ranking ao vivo · +R$ 1.000.000 em prêmios
        </div>
      </div>
    ),
    { ...size },
  );
}
