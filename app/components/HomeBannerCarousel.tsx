"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import bannerBolao from "@/app/assets/banner-bolao.png";
import bannerIndique from "@/app/assets/banner-indique-ganhe.png";

/** Banners da home — auto-rotação a cada 5s, slide horizontal, responsivo. */
type SlideId = "cota" | "indique";

const SLIDES: {
  id: SlideId;
  src: typeof bannerBolao;
  href: string;
  alt: string;
}[] = [
  {
    id: "cota",
    src: bannerBolao,
    href: "/tickets",
    alt: "Garanta sua cota no maior bolão da Copa",
  },
  {
    id: "indique",
    src: bannerIndique,
    href: "/indique",
    alt: "Indique e ganhe R$12 por indicação paga",
  },
];

const INTERVAL_MS = 5000;

export function HomeBannerCarousel({ fullWidth = false }: { fullWidth?: boolean }) {
  const router = useRouter();
  const { openPromotion, getPromotionPrefetch } = usePromotionsHub();
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, INTERVAL_MS);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const goTo = useCallback(
    (i: number) => {
      setIndex(i);
      startTimer(); // reinicia o timer ao navegar manualmente
    },
    [startTimer],
  );

  // Swipe lateral (mobile): arrasta pro lado pra trocar de banner.
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchDeltaX.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = (e.touches[0]?.clientX ?? 0) - touchStartX.current;
  };
  const onTouchEnd = () => {
    const delta = touchDeltaX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    const len = SLIDES.length;
    setIndex((i) => (delta < 0 ? (i + 1) % len : (i - 1 + len) % len));
    startTimer();
  };

  return (
    <section className="w-full">
      <div className={`mx-auto w-full ${fullWidth ? "lg:max-w-none lg:px-0" : "px-3.5 lg:max-w-[720px]"} max-w-[460px] px-3.5`}>
        <div
          className="relative overflow-hidden rounded-[16px] border border-white/8 bg-[#0a0a0a] shadow-[0_10px_36px_rgba(0,0,0,0.45)]"
          style={{ touchAction: "pan-y" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Track — desliza horizontalmente */}
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {SLIDES.map((slide, i) => (
              <Link
                key={slide.id}
                href={slide.href}
                className="block w-full shrink-0"
                aria-label={slide.alt}
              >
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  className="h-auto w-full"
                  priority={i === 0}
                  sizes="(max-width: 430px) 100vw, 1300px"
                  draggable={false}
                />
              </Link>
            ))}
          </div>

          {/* Indicadores */}
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para o banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-5 bg-[#B1EB0B]" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
