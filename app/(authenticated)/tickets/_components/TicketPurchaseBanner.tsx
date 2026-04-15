"use client";

import bgPalpitesMobile from "@/app/assets/banner-mobile-ticket.png";

export function TicketPurchaseBanner() {
  return (
    <img src={bgPalpitesMobile.src} alt="Banner de compra de bilhetes" className="w-full h-full object-cover rounded-b-3xl" />
  );
}
