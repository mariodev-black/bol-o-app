import { Header } from "@/app/shared/Header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0E141B" }}>
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
