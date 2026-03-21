import type { Metadata, Viewport } from "next";
import { Montserrat, DM_Sans } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Bolão do Milhão | Faça seus palpites e concorra a prêmios milionários",
  description:
    "Participe do Bolão do Milhão, o maior bolão de futebol do Brasil. Faça seus palpites, suba no ranking e concorra a prêmios milionários. Mais de 52.000 jogadores ativos. Inscreva-se agora!",
  keywords: [
    "bolão",
    "bolão do milhão",
    "bolão de futebol",
    "palpites futebol",
    "prêmios futebol",
    "bolão online",
    "ranking futebol",
    "concurso futebol",
  ],
  authors: [{ name: "Bolão do Milhão" }],
  creator: "Bolão do Milhão",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "Bolão do Milhão | Prêmios Milionários",
    description:
      "Faça seus palpites de futebol, suba no ranking e concorra a prêmios milionários. Mais de 52.000 jogadores ativos no maior bolão do Brasil!",
    siteName: "Bolão do Milhão",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bolão do Milhão | Prêmios Milionários",
    description:
      "Faça seus palpites de futebol, suba no ranking e concorra a prêmios milionários. Mais de 52.000 jogadores ativos no maior bolão do Brasil!",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} ${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        {modal}
      </body>
    </html>
  );
}
