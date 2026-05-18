"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/app/shared/AuthContext";

export function HomePageContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, isLoggedIn } = useAuth();
  const guestHomeNoHeaderMobile = ready && (pathname ?? "") === "/" && !isLoggedIn;

  return (
    <div
      className={
        guestHomeNoHeaderMobile
          ? "flex flex-col bg-[#000000] pt-[var(--app-header-banner-height,0px)] lg:pt-[var(--app-header-height,86.5px)] text-white overflow-hidden"
          : "flex flex-col bg-[#000000] pt-[var(--app-header-height,86.5px)] text-white overflow-hidden"
      }
    >
      {children}
    </div>
  );
}
