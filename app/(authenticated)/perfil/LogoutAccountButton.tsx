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
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[16px] font-black text-red-400/95 transition-colors hover:bg-red-500/10 hover:text-red-300"
      onClick={async () => {
        await logout();
        router.push("/login");
      }}
    >
      <LogOut className="size-4 shrink-0" strokeWidth={2.25} />
      Sair da conta
    </button>
  );
}
