"use client";

import { Menu as MenuIcon } from "lucide-react";
import { NotificationsBell } from "@/app/shared/NotificationsBell";
import { useSidenav } from "@/app/shared/SidenavContext";
import { useStandalonePwa } from "@/app/shared/useStandalonePwa";
import { useAuth } from "@/app/shared/AuthContext";

/** Menu + sininho no PWA (sem header com logo/banner). */
export function PwaFloatingChrome() {
  const { ready, isLoggedIn } = useAuth();
  const isPwa = useStandalonePwa();
  const { openSidenav } = useSidenav();

  if (!ready || !isLoggedIn || !isPwa) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        height: `calc(env(safe-area-inset-top, 0px) + 48px)`,
      }}
    >
      <div className="flex h-12 items-center justify-between px-4">
        <button
          type="button"
          className="pointer-events-auto flex size-10 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/8"
          aria-label="Abrir menu"
          onClick={openSidenav}
        >
          <MenuIcon className="size-6" strokeWidth={2.25} />
        </button>
        <div className="pointer-events-auto">
          <NotificationsBell variant="mobile" />
        </div>
      </div>
    </div>
  );
}
