import type { Metadata } from "next";
import { HomePageClient } from "@/app/components/HomePageClient";
import { buildPageMetadata } from "@/lib/seo/config";
import { HomePageJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = buildPageMetadata({
  title: "Bolão do Milhão — Bolão da Copa 2026 | Mais de R$ 1 milhão em prêmios",
  description:
    "Entre no Bolão do Milhão, o bolão da Copa 2026 mais disputado do Brasil. Palpites nos jogos, ranking ao vivo, prêmios milionários e cota por R$ 39,90. Cadastre-se grátis e garanta sua vaga.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <HomePageJsonLd />
      <HomePageClient />
    </>
  );
}
