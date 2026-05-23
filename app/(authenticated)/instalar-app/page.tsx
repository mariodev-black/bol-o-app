import type { Metadata } from "next";
import { InstalarAppClient } from "@/app/(authenticated)/instalar-app/InstalarAppClient";
import { buildPageMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildPageMetadata({
  title: "Baixar aplicativo",
  description:
    "Instale o Bolão do Milhão no celular (PWA) e ative notificações para não perder prazos de palpite.",
  path: "/instalar-app",
  noIndex: true,
});

export default function InstalarAppPage() {
  return <InstalarAppClient />;
}
