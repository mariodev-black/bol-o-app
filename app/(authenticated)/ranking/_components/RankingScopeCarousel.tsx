"use client";

import { ChevronRight, MoveHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RANKING_GREEN } from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";

function CarouselSwipeHint() {
  return (
    <div className="mb-3 flex items-center justify-center gap-2" aria-hidden>
      <span className="inline-flex items-center text-primary/50">
        <ChevronRight className="size-4 rotate-180" strokeWidth={2.5} />
        <ChevronRight className="size-3 -ml-1.5 rotate-180 opacity-60" strokeWidth={2.5} />
      </span>

      <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <MoveHorizontal
          className="size-4 shrink-0 animate-pulse text-primary"
          strokeWidth={2.35}
        />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
          Deslize
        </span>
      </span>

      <span className="inline-flex items-center text-primary/50">
        <ChevronRight className="size-3 opacity-60" strokeWidth={2.5} />
        <ChevronRight className="size-4 -ml-1.5" strokeWidth={2.5} />
      </span>
    </div>
  );
}

export function RankingScopeCarousel({
  children,
  itemCount,
  tone = RANKING_GREEN,
}: {
  children: React.ReactNode;
  itemCount: number;
  tone?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const showCarousel = itemCount > 1;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !showCarousel) return;
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) {
        setActiveIdx(0);
        return;
      }
      const t = el.scrollLeft / max;
      setActiveIdx(
        Math.min(itemCount - 1, Math.max(0, Math.round(t * (itemCount - 1)))),
      );
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [itemCount, showCarousel]);

  if (!showCarousel) {
    return <div>{children}</div>;
  }

  return (
    <div>
      <CarouselSwipeHint />
      <div
        ref={scrollRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Carrossel de bolões — deslize para o lado"
      >
        {children}
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {Array.from({ length: itemCount }, (_, i) => (
          <span
            key={i}
            className={
              i === activeIdx
                ? "h-1.5 w-6 shrink-0 rounded-full transition-[width,background-color] duration-300"
                : "size-1.5 shrink-0 rounded-full bg-white/20 transition-[width,background-color] duration-300"
            }
            style={i === activeIdx ? { background: tone } : undefined}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
