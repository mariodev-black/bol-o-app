"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/app/shared/AuthContext";

type TicketPurchaseLinkProps = {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  /** Destino após login ou após cadastro (ex.: `/tickets`, `/tickets?bolao=diario`). */
  destination?: string;
};

function ticketFlowHref(destination: string, isLoggedIn: boolean): string {
  if (isLoggedIn) return destination;
  const from = destination.startsWith("/") ? destination : "/tickets";
  /** Página pública (home); `from` + código em storage/cookie seguem o fluxo normal após login/cadastro. */
  return `/?from=${encodeURIComponent(from)}`;
}

export function TicketPurchaseLink({
  children,
  className,
  ariaLabel,
  destination = "/tickets",
}: TicketPurchaseLinkProps) {
  const { ready, isLoggedIn } = useAuth();
  const from = destination.startsWith("/") ? destination : "/tickets";
  const href = ready ? ticketFlowHref(destination, isLoggedIn) : `/?from=${encodeURIComponent(from)}`;

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
