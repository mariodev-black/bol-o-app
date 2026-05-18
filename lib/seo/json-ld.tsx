import { getAppOrigin, getMarketingOrigin, HOME_FAQ, SITE_NAME, SITE_TAGLINE } from "@/lib/seo/config";

function JsonLdScript({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function HomePageJsonLd() {
  const origin = getMarketingOrigin();
  const appOrigin = getAppOrigin();

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: origin,
    logo: `${origin}/favicon.ico`,
    description: SITE_TAGLINE,
    sameAs: ["https://www.instagram.com/w18walter/"],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: ["Bolao do Milhao", "Bolão da Copa 2026", "Bolão Copa do Mundo"],
    url: origin,
    description: SITE_TAGLINE,
    inLanguage: "pt-BR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${origin}/#webpage`,
    url: origin,
    name: `${SITE_NAME} — Bolão da Copa 2026 com prêmios milionários`,
    description:
      "Participe do maior bolão da Copa 2026: palpites, ranking ao vivo e mais de R$ 1 milhão em prêmios.",
    isPartOf: { "@id": `${origin}/#website` },
    about: {
      "@type": "SportsEvent",
      name: "Copa do Mundo FIFA 2026",
      sport: "Futebol",
    },
    inLanguage: "pt-BR",
  };

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `Cota ${SITE_NAME} — Bolão da Copa 2026`,
    description: "Ticket de participação no Bolão do Milhão com acesso a palpites e ranking.",
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      url: `${appOrigin}/cadastrar?from=/tickets`,
      priceCurrency: "BRL",
      price: "39.90",
      availability: "https://schema.org/InStock",
      validFrom: "2025-01-01",
    },
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const sportsEvent = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: "Bolão do Milhão — Copa do Mundo 2026",
    description:
      "Concurso de palpites esportivos para a Copa do Mundo 2026 com premiação em dinheiro.",
    sport: "Futebol",
    organizer: {
      "@type": "Organization",
      name: SITE_NAME,
      url: origin,
    },
    location: {
      "@type": "Country",
      name: "Brasil",
    },
  };

  return (
    <>
      <JsonLdScript data={organization} />
      <JsonLdScript data={website} />
      <JsonLdScript data={webPage} />
      <JsonLdScript data={product} />
      <JsonLdScript data={faqPage} />
      <JsonLdScript data={sportsEvent} />
    </>
  );
}
