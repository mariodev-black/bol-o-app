"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/app/shared/AuthContext";
import { useProductHref } from "@/app/shared/useProductHref";

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
  /** Cadastro com retorno pós-conta; `ref` pendente continua em localStorage/cookie (ReferralCapture + Cadastrar). */
  return `/cadastrar?from=${encodeURIComponent(from)}`;
}

export function TicketPurchaseLink({
  children,
  className,
  ariaLabel,
  destination = "/tickets",
}: TicketPurchaseLinkProps) {
  const { ready, isLoggedIn } = useAuth();
  const from = destination.startsWith("/") ? destination : "/tickets";
  const relativeHref = ready
    ? ticketFlowHref(destination, isLoggedIn)
    : `/cadastrar?from=${encodeURIComponent(from)}`;
  const href = useProductHref(relativeHref);

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
