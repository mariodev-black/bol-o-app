"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/app/shared/AuthContext";

type TicketPurchaseLinkProps = {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

export function TicketPurchaseLink({
  children,
  className,
  ariaLabel,
}: TicketPurchaseLinkProps) {
  const { ready, isLoggedIn } = useAuth();
  const href = ready && isLoggedIn ? "/tickets" : "/login?from=/tickets";

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center text-center no-underline ${
        className ?? ""
      }`}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
