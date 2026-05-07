import { AdminShell } from "@/app/admin/_components/AdminShell";
import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
