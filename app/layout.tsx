import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { DM_Sans, Montserrat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { getAppServerConfig } from "@/lib/app-server-config";
import { parseHostnameFromHostHeader } from "@/lib/auth/request-host";
import { buildRootMetadata } from "@/lib/seo/config";
import {
  isAppHostname,
  isMarketingHostname,
  isSubdomainRoutingEnabled,
} from "@/lib/site-hosts";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { isDynamicServerUsageError } from "@/lib/next/dynamic-server-error";
import { Providers } from "./providers";

/** Sessão e host dependem de cookies/headers — evita tentativa de SSG ruidosa no build. */
export const dynamic = "force-dynamic";

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
  themeColor: "#B1EB0B",
  colorScheme: "dark",
};

export const metadata: Metadata = buildRootMetadata();

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  let hostname = "";
  let isMarketingRequest = false;
  try {
    const headersList = await headers();
    const hostRaw = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
    hostname = parseHostnameFromHostHeader(hostRaw);
    const routing = isSubdomainRoutingEnabled();
    isMarketingRequest =
      routing && Boolean(hostname) && isMarketingHostname(hostname) && !isAppHostname(hostname);
  } catch (error) {
    if (!isDynamicServerUsageError(error)) {
      console.error("[layout] headers failed", error);
    }
  }

  const appServerConfig = {
    ...getAppServerConfig(),
    isMarketingRequest,
  };
  const initialAuthUser = await getServerAuthUser().catch((error) => {
    if (!isDynamicServerUsageError(error)) {
      console.error("[layout] getServerAuthUser failed", error);
    }
    return null;
  });

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
        <Providers appServerConfig={appServerConfig} initialAuthUser={initialAuthUser}>
          {children}
          {modal}
        </Providers>
      </body>
    </html>
  );
}
