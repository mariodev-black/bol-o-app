import { hasValidAdmin2fa, getCurrentAdminUser } from "@/lib/admin/auth";
import { redirect } from "next/navigation";
import { AdminLoginClient } from "./AdminLoginClient";

export default async function AdminLoginPage() {
  const admin = await getCurrentAdminUser();
  if (admin) {
    if (admin.twoFactorEnabled && await hasValidAdmin2fa(admin.id)) redirect("/admin");
    redirect("/admin/2fa");
  }

  return <AdminLoginClient />;
}
