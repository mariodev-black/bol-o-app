import { AuthHeader } from "@/app/shared/AuthHeader";
import { NavBottom } from "@/app/shared/NavBottom";
import { SideNav } from "@/app/shared/SideNav";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#03060D]">

      {/* Header mobile */}
      <div className="md:hidden sticky top-0 z-40">
        <AuthHeader />
      </div>

      {/* Corpo: sidenav + conteúdo lado a lado no desktop, empilhados no mobile */}
      <div className="md:flex md:items-start">
        <SideNav />
        <main className="flex-1 min-w-0 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      <NavBottom />
    </div>
  );
}
