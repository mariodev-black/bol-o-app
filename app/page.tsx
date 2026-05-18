import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { HomePageClient } from "@/app/components/HomePageClient";
import { parseHostnameFromHostHeader } from "@/lib/auth/request-host";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import type { HomePageServerHint } from "@/lib/home-page-server-hint";
import { buildPageMetadata } from "@/lib/seo/config";
import { HomePageJsonLd } from "@/lib/seo/json-ld";
import { isAppHostname, isMarketingHostname } from "@/lib/site-domain";

export const metadata: Metadata = buildPageMetadata({
  title: "Bolão do Milhão — Bolão da Copa 2026 | Mais de R$ 1 milhão em prêmios",
  description:
    "Entre no Bolão do Milhão, o bolão da Copa 2026 mais disputado do Brasil. Palpites nos jogos, ranking ao vivo, prêmios milionários e cota por R$ 39,90. Cadastre-se grátis e garanta sua vaga.",
  path: "/",
});

async function getHomePageServerHint(): Promise<HomePageServerHint> {
  const headersList = await headers();
  const hostRaw = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
  const hostname = parseHostnameFromHostHeader(hostRaw);
  const onApp = isAppHostname(hostname);
  const onMarketing = isMarketingHostname(hostname);

  let initialLoggedIn = false;
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (token) {
    initialLoggedIn = Boolean(await verifySessionToken(token).catch(() => null));
  }

  return { onApp, onMarketing, initialLoggedIn };
}

export default async function HomePage() {
  const hint = await getHomePageServerHint();

  return (
    <>
      <HomePageJsonLd />
      <HomePageClient hint={hint} />
    </>
  );
}
