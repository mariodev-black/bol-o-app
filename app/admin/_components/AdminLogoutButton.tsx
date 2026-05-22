"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  className?: string;
  onDone?: () => void;
};

export function AdminLogoutButton({ className, onDone }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
      onDone?.();
      router.replace("/admin/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={loading}
      className={
        className ??
        "flex w-full items-center justify-center gap-2 rounded-[12px] border border-red-500/20 bg-red-500/8 px-3 py-2.5 text-[12px] font-black uppercase tracking-[0.14em] text-red-300 transition-colors hover:border-red-400/35 hover:bg-red-500/14 disabled:opacity-50"
      }
    >
      <LogOut className="h-4 w-4" strokeWidth={2.2} />
      {loading ? "Saindo..." : "Sair do admin"}
    </button>
  );
}
