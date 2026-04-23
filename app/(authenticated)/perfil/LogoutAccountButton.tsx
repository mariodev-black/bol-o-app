"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/app/shared/AuthContext";

export function LogoutAccountButton() {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <button
      type="button"
      className="w-full rounded-2xl border h-12 text-[16px] font-black inline-flex items-center justify-center gap-2"
      style={{
        borderColor: "rgba(239,68,68,0.35)",
        color: "#F87171",
        background: "linear-gradient(180deg, rgba(127,29,29,0.22) 0%, rgba(69,10,10,0.38) 100%)",
      }}
      onClick={async () => {
        await logout();
        router.push("/login");
      }}
    >
      <LogOut className="w-4.5 h-4.5" />
      Sair da conta
    </button>
  );
}
