import { NavBottom } from "@/app/shared/NavBottom";
import { Header } from "../shared/Header";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 pt-16">
        <main className="flex flex-1 flex-col pb-24 md:pb-8 min-w-0">{children}</main>
      </div>
      <NavBottom />
    </div>
  );
}
