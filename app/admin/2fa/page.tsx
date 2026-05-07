import { TwoFactorClient } from "@/app/admin/2fa/TwoFactorClient";
import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminTwoFactorPage() {
  const admin = await requireAdmin({ require2fa: false });
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-white">
      <TwoFactorClient enabled={admin.twoFactorEnabled} />
    </div>
  );
}
