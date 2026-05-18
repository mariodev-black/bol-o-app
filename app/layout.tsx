import type { Metadata, Viewport } from "next";
import { DM_Sans, Montserrat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { getAppServerConfig } from "@/lib/app-server-config";
import { buildRootMetadata } from "@/lib/seo/config";
import { InternalCronBootstrap } from "./InternalCronBootstrap";
import { Providers } from "./providers";

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

/** Opcional: use `font-helvetica-now-display` ou `var(--font-helvetica-now-display)` onde quiser Helvetica */
const helveticaNowDisplay = localFont({
  src: [
    { path: "./assets/font/HelveticaNowDisplay-Hairline.woff2", weight: "100", style: "normal" },
    { path: "./assets/font/HelveticaNowDisplay-Thin.woff2", weight: "100", style: "normal" },
    { path: "./assets/font/HelveticaNowDisplay-HairlineI.woff2", weight: "100", style: "italic" },
    { path: "./assets/font/HelveticaNowDisplay-ThinIta.woff2", weight: "100", style: "italic" },
    { path: "./assets/font/HelveticaNowDisplay-ExtLt.woff2", weight: "300", style: "normal" },
    { path: "./assets/font/HelveticaNowDisplay-Light.woff2", weight: "300", style: "normal" },
    { path: "./assets/font/HelveticaNowDisplay-ExtLtIta.woff2", weight: "300", style: "italic" },
    { path: "./assets/font/HelveticaNowDisplay-LightIta.woff2", weight: "300", style: "italic" },
    { path: "./assets/font/HelveticaNowDisplay-Regular.woff2", weight: "400", style: "normal" },
    { path: "./assets/font/HelveticaNowDisplay-ExtBlk.woff2", weight: "400", style: "normal" },
    { path: "./assets/font/HelveticaNowDisplay-RegIta.woff2", weight: "400", style: "italic" },
    { path: "./assets/font/HelveticaNowDisplay-ExtBlkIta.woff2", weight: "400", style: "italic" },
    { path: "./assets/font/HelveticaNowDisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "./assets/font/HelveticaNowDisplay-MedIta.woff2", weight: "500", style: "italic" },
    { path: "./assets/font/HelveticaNowDisplay-Bold.woff2", weight: "700", style: "normal" },
    { path: "./assets/font/HelveticaNowDisplay-BoldIta.woff2", weight: "700", style: "italic" },
    { path: "./assets/font/HelveticaNowDisplay-ExtraBold.woff2", weight: "800", style: "normal" },
    { path: "./assets/font/HelveticaNowDisplay-ExtBdIta.woff2", weight: "800", style: "italic" },
    { path: "./assets/font/HelveticaNowDisplay-Black.woff2", weight: "900", style: "normal" },
    { path: "./assets/font/HelveticaNowDisplay-BlackIta.woff2", weight: "900", style: "italic" },
  ],
  variable: "--font-helvetica-now-display",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = buildRootMetadata();

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  const appServerConfig = getAppServerConfig();

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${montserrat.variable} ${dmSans.variable} ${helveticaNowDisplay.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[#000000] text-foreground"
      >
        <InternalCronBootstrap />
        <Providers appServerConfig={appServerConfig}>
          {children}
          {modal}
        </Providers>
      </body>
    </html>
  );
}
