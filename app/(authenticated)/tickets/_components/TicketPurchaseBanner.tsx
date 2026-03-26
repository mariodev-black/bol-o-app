"use client";

import Image from "next/image";
import bgPalpitesMobile from "@/app/assets/banner-mobile-ticket.png";
import ticketGold from "@/app/assets/ticket-gold.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";

export function TicketPurchaseBanner() {
  return (
    <section className="relative w-full min-h-[240px] sm:min-h-[280px] overflow-hidden">
      <Image src={bgPalpitesMobile} alt="Banner de compra de bilhetes" fill className="object-cover object-center" priority />
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#070A12]/40 to-[#070A12]/90" />

      <div className="absolute right-4 top-4 sm:right-7 sm:top-6 pointer-events-none select-none">
        <div className="relative w-[170px] h-[165px] sm:w-[210px] sm:h-[205px]">
          <Image
            src={ticketBlue}
            alt=""
            aria-hidden
            className="absolute left-0 bottom-0 w-[112px] sm:w-[134px] h-auto drop-shadow-[0_10px_26px_rgba(37,99,235,0.45)]"
          />
          <Image
            src={ticketGold}
            alt=""
            aria-hidden
            className="absolute right-0 top-0 w-[112px] sm:w-[134px] h-auto rotate-[8deg] drop-shadow-[0_12px_28px_rgba(250,204,21,0.45)]"
          />
        </div>
      </div>
    </section>
  );
}
