import { AuthHeader } from "@/app/shared/AuthHeader";
import { NavBottom } from "@/app/shared/NavBottom";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0E141B" }}>
      <AuthHeader />
      <main className="flex flex-1 flex-col pb-24">{children}</main>
      <NavBottom />
    </div>
  );
}
