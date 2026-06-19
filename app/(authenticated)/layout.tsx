import type { Metadata } from "next";
import { NavBottom } from "@/app/shared/NavBottom";
import { PushNotificationsModal } from "@/app/shared/PushNotificationsModal";
import { Header } from "../shared/Header";
import { DesktopSidebar } from "../shared/DesktopSidebar";
import { Suspense } from "react";
import { buildPageMetadata } from "@/lib/seo/config";
import { AuthenticatedErrorShell } from "./AuthenticatedErrorShell";

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
    <AuthenticatedErrorShell>
      <div className="min-h-screen flex flex-col">
        <PushNotificationsModal />
        <Header />
        <div className="flex flex-1 pt-[var(--app-header-height,55px)] lg:pt-[var(--app-header-height,64px)]">
          {/* Sidebar — desktop only (fixa no topo, logo no canto sup esq) */}
          <aside className="hidden lg:block lg:w-[210px] lg:shrink-0">
            <div className="fixed left-0 top-0 z-[60] h-screen w-[210px]">
              <DesktopSidebar className="h-full" />
            </div>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col pb-32 md:pb-8">{children}</main>
        </div>
        <Suspense fallback={null}>
          <NavBottom />
        </Suspense>
      </div>
    </AuthenticatedErrorShell>
  );
}
