import type { Metadata } from "next";
import { NavBottom } from "@/app/shared/NavBottom";
import { PushNotificationsBanner } from "@/app/shared/PushNotificationsBanner";
import { PushNotificationsModal } from "@/app/shared/PushNotificationsModal";
import { Header } from "../shared/Header";
import { Suspense } from "react";
import { buildPageMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildPageMetadata({
  title: "Área do participante",
  description: "Área logada do Bolão do Milhão.",
  noIndex: true,
});

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <PushNotificationsBanner />
      <PushNotificationsModal />
      <Header />
      <div className="flex flex-1 pt-[var(--app-header-height,96px)] md:pt-[var(--app-header-height,96px)]">
        <main className="flex min-w-0 flex-1 flex-col pb-32 md:pb-8">{children}</main>
      </div>
      <Suspense fallback={null}>
        <NavBottom />
      </Suspense>
    </div>
  );
}
