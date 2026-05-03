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
          ? "flex flex-col bg-[#000000] pt-0 lg:pt-[86.5px] text-white overflow-hidden"
          : "flex flex-col bg-[#000000] pt-[86.5px] text-white overflow-hidden"
      }
    >
      {children}
    </div>
  );
}
