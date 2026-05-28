"use client";

import Image from "next/image";
import Link from "next/link";
import { HOME_INFLUENCERS } from "@/lib/home-influencers";

const GREEN = "#B1EB0B";
const CARD_BG = "#111111";

function InfluencerImageCard({
  handle,
  instagramUrl,
  cardImage,
}: {
  handle: string;
  instagramUrl: string;
  cardImage: (typeof HOME_INFLUENCERS)[number]["cardImage"];
}) {
  return (
    <a
      href={instagramUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[96px] min-w-0 items-center justify-center overflow-hidden rounded-[14px] px-1.5 py-2.5 transition-[filter,transform] hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      style={{ backgroundColor: CARD_BG }}
      aria-label={`${handle} no Instagram`}
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
    </a>
  );
}

export function QuemEstaNoBolaoSection({ className = "mt-5" }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="quem-esta-no-bolao-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3
          id="quem-esta-no-bolao-heading"
          className="text-[15px] font-black uppercase tracking-[0.04em] text-white"
        >
          QUEM JÁ ESTÁ NO BOLÃO
        </h3>
        <Link
          href="https://www.instagram.com/w18walter/"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[13px] font-black uppercase tracking-wide transition-opacity hover:opacity-90"
          style={{ color: GREEN }}
        >
          VER TODOS &gt;
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {HOME_INFLUENCERS.map((influencer) => (
          <InfluencerImageCard key={influencer.handle} {...influencer} />
        ))}
      </div>
    </section>
  );
}
