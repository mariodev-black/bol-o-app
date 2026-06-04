"use client";

import { Gift } from "lucide-react";
import { usePromotionsHub } from "@/app/shared/PromotionsHubContext";

export function PromotionsGiftButton({
  variant: _variant,
}: {
  variant: "mobile" | "desktop";
}) {
  const { highlightCount, openPromotionsSheet } = usePromotionsHub();

  const showNovoBadge = highlightCount > 0;
  const wrapClass = "promo-gift-trigger-wrap promo-gift-trigger-wrap--live";

  return (
    <div className={wrapClass}>
      <button
        type="button"
        onClick={openPromotionsSheet}
        className="promo-gift-trigger-btn"
        aria-label="Promoções"
      >
        {showNovoBadge ? (
          <span className="pointer-events-none absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-black uppercase leading-none tracking-wide text-[#0E141B]">
            Novo
          </span>
        ) : null}
        <Gift className="relative z-1 size-5 text-primary" strokeWidth={2} />
      </button>
    </div>
  );
}
