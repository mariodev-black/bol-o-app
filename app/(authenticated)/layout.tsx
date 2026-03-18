import { AuthHeader } from "@/app/shared/AuthHeader";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0E141B" }}>
      <AuthHeader />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
