import type { Metadata } from "next";

const DEFAULT_MARKETING = "https://www.bolaodomilhao.com.br";
const DEFAULT_APP = "https://bolaodomilhao.com.br";

/** URL canônica do site de vendas (www). Usada em sitemap, OG e canonical da home. */
export function getMarketingOrigin(): string {
  const raw = (
    process.env.MARKETING_URL ||
    process.env.NEXT_PUBLIC_MARKETING_URL ||
    process.env.APP_URL ||
    DEFAULT_MARKETING
  ).trim();
  return normalizeOrigin(raw, DEFAULT_MARKETING);
}

/** URL do app (palpites, login). Fallback quando não houver MARKETING_URL. */
export function getAppOrigin(): string {
  const raw = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP).trim();
  return normalizeOrigin(raw, DEFAULT_APP);
}

function normalizeOrigin(raw: string, fallback: string): string {
  if (!raw) return fallback;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return raw.replace(/\/+$/, "") || fallback;
  }
}

export const SITE_NAME = "Bolão do Milhão";
export const SITE_TAGLINE = "O maior bolão da Copa 2026 do Brasil";

export const SEO_KEYWORDS = [
  "bolão do milhão",
  "bolao do milhao",
  "bolão da copa",
  "bolao da copa",
  "bolão copa 2026",
  "bolão da copa do mundo",
  "bolão copa do mundo 2026",
  "bolão online",
  "bolão de futebol",
  "palpites copa 2026",
  "palpites futebol",
  "ranking bolão",
  "prêmio bolão",
  "bolão com prêmio em dinheiro",
  "concurso de palpites",
  "bolão milionário",
  "participar bolão copa",
  "garantir cota bolão",
] as const;

const DEFAULT_DESCRIPTION =
  "Bolão do Milhão: o maior bolão da Copa 2026 do Brasil. Faça seus palpites nos jogos, suba no ranking em tempo real e concorra a mais de R$ 1 milhão em prêmios. Cadastre-se e garanta sua cota por R$ 39,90.";

type PageMetaInput = {
  title: string;
  description?: string;
  path?: string;
  /** Se omitido, usa marketing origin + path */
  canonicalOrigin?: string;
  noIndex?: boolean;
  keywords?: string[];
};

export function buildPageMetadata(input: PageMetaInput): Metadata {
  const origin = input.canonicalOrigin ?? getMarketingOrigin();
  const path = input.path ?? "/";
  const url = path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  const description = input.description ?? DEFAULT_DESCRIPTION;
  const title = input.title.includes(SITE_NAME) ? input.title : `${input.title} | ${SITE_NAME}`;
  const keywords = input.keywords ?? [...SEO_KEYWORDS];

  return {
    title,
    description,
    keywords,
    authors: [{ name: SITE_NAME, url: origin }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    metadataBase: new URL(origin),
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url,
      siteName: SITE_NAME,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: input.noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}

export function buildRootMetadata(): Metadata {
  const marketing = getMarketingOrigin();
  const title = `${SITE_NAME} | Bolão da Copa 2026 — Prêmios de mais de R$ 1 milhão`;

  return {
    ...buildPageMetadata({
      title,
      description: DEFAULT_DESCRIPTION,
      path: "/",
      canonicalOrigin: marketing,
    }),
    applicationName: SITE_NAME,
    category: "sports",
    classification: "Bolão esportivo, palpites futebol, Copa do Mundo",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    other: {
      "geo.region": "BR",
      "geo.placename": "Brasil",
      "content-language": "pt-BR",
    },
  };
}

export const HOME_FAQ = [
  {
    question: "O que é o Bolão do Milhão?",
    answer:
      "O Bolão do Milhão é um bolão online da Copa do Mundo 2026 no qual você registra palpites de placar, acumula pontos conforme regras claras e concorre a prêmios em dinheiro, com mais de R$ 1 milhão em premiação total.",
  },
  {
    question: "Como participar do bolão da Copa 2026?",
    answer:
      "Basta criar sua conta, garantir sua cota (ticket), enviar seus palpites antes do fechamento de cada partida e acompanhar sua posição no ranking em tempo real.",
  },
  {
    question: "Quanto custa para entrar no Bolão do Milhão?",
    answer:
      "A cota do bolão custa R$ 39,90. Com ela você participa da disputa principal, envia palpites e concorre aos prêmios conforme o regulamento.",
  },
  {
    question: "Como funciona a pontuação do bolão?",
    answer:
      "Você ganha mais pontos ao acertar o placar exato; também pontua por acertar vencedor, gols de um time e outras combinações previstas no regulamento do Bolão do Milhão.",
  },
  {
    question: "O Bolão do Milhão é confiável?",
    answer:
      "Sim. O bolão possui regulamento, ranking transparente, pagamento de prêmios e suporte. Consulte os Termos e a Política de Privacidade no site.",
  },
] as const;
