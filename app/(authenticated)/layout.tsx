import { NavBottom } from "@/app/shared/NavBottom";
import { Header } from "../shared/Header";
import { Suspense } from "react";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 pt-[var(--app-header-height,96px)] md:pt-[var(--app-header-height,96px)]">
        <main className="flex flex-1 flex-col pb-24 md:pb-8 min-w-0">{children}</main>
      </div>
      <Suspense fallback={null}>
        <NavBottom />
      </Suspense>
    </div>
  );
}
