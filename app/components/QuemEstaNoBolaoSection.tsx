"use client";

import Image from "next/image";
import Link from "next/link";
import { HOME_INFLUENCERS } from "@/lib/home-influencers";
import logoInstagram from "@/app/assets/icon-instagram.png";

const CARD_BG = "#111111";
const INSTAGRAM_URL = "https://instagram.com/bolaodomilhao26";

function OfficialInstagramCard() {
  return (
    <Link
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[96px] min-w-0 items-center justify-center overflow-hidden rounded-[14px] px-1.5 py-2.5 transition-transform active:scale-[0.98]"
      style={{ backgroundColor: CARD_BG }}
      aria-label="Instagram oficial @bolaodomilhao26"
    >
      <Image
        src={logoInstagram}
        alt="@bolaodomilhao26"
        width={1358}
        height={1158}
        className="h-[96px] w-auto max-w-full origin-center scale-[2.01] object-contain pt-1"
        draggable={false}
        sizes="(max-width: 430px) 30vw"
      />
    </Link>
  );
}

function InfluencerImageCard({
  handle,
  cardImage,
}: {
  handle: string;
  cardImage: (typeof HOME_INFLUENCERS)[number]["cardImage"];
}) {
  return (
    <div
      className="flex min-h-[96px] min-w-0 items-center justify-center overflow-hidden rounded-[14px] px-1.5 py-2.5"
      style={{ backgroundColor: CARD_BG }}
      aria-label={handle}
    >
      <Image
        src={cardImage}
        alt={handle}
        width={160}
        height={96}
        className="h-[96px] w-auto max-w-full object-contain"
        draggable={false}
        sizes="(max-width: 430px) 30vw"
      />
    </div>
  );
}

export function QuemEstaNoBolaoSection({ className = "mt-5" }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="quem-esta-no-bolao-heading">
      <div className="mb-3">
        <h3
          id="quem-esta-no-bolao-heading"
          className="text-[15px] font-black uppercase tracking-[0.04em] text-white"
        >
          QUEM JÁ ESTÁ NO BOLÃO
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {HOME_INFLUENCERS.map((influencer) => (
          <InfluencerImageCard
            key={influencer.handle}
            handle={influencer.handle}
            cardImage={influencer.cardImage}
          />
        ))}
        <OfficialInstagramCard />
      </div>
    </section>
  );
}
