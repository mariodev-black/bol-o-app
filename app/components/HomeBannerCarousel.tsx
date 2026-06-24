"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import bannerBolao from "@/app/assets/banner-bolao.png";
import bannerBraMar from "@/app/assets/banner-brasil-marrocos.png";
import bannerIndique from "@/app/assets/banner-indique-ganhe.png";
import type { HomeBanner } from "@/lib/home-content/types";

/** Banners da home — auto-rotação a cada 5s, slide horizontal, responsivo. */
type Slide = {
  id: string;
  src: StaticImageData | string;
  href: string;
  alt: string;
};

/** Conteúdo padrão (fallback) quando o admin ainda não cadastrou banners. */
const FALLBACK_SLIDES: Slide[] = [
  { id: "cota", src: bannerBolao, href: "/comprar-cotas", alt: "Garanta sua cota no maior bolão da Copa" },
  { id: "palpite", src: bannerBraMar, href: "/palpites", alt: "Faça seus palpites e dispute o ranking" },
  { id: "indique", src: bannerIndique, href: "/indique", alt: "Indique e ganhe R$12 por indicação paga" },
];

const INTERVAL_MS = 5000;

export function HomeBannerCarousel({
  fullWidth = false,
  fillHeight = false,
}: {
  fullWidth?: boolean;
  fillHeight?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [dynamicSlides, setDynamicSlides] = useState<Slide[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Busca banners dinâmicos do admin; se não houver nenhum, usa o fallback.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/public/home-content", { cache: "no-store" });
        const d = (await r.json()) as { banners?: HomeBanner[] };
        if (cancelled) return;
        const usable = (d.banners ?? []).filter((b) => b.imageUrl);
        if (usable.length > 0) {
          setDynamicSlides(
            usable.map((b) => ({
              id: b.id,
              src: b.imageUrl as string,
              href: b.href || "#",
              alt: b.alt || "",
            })),
          );
        }
      } catch {
        /* mantém fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const SLIDES = dynamicSlides ?? FALLBACK_SLIDES;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, INTERVAL_MS);
  }, [SLIDES.length]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  // Clampa no render (sem efeito) caso a lista dinâmica encurte a quantidade.
  const safeIndex = index >= SLIDES.length ? 0 : index;

  const goTo = useCallback(
    (i: number) => {
      setIndex(i);
      startTimer();
    },
    [startTimer],
  );

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
    <section
      className={`w-full min-w-0 max-w-full overflow-hidden ${fillHeight ? "lg:h-full" : ""}`}
    >
      <div
        className={`mx-auto w-full min-w-0 max-w-[460px] px-3.5 ${
          fullWidth ? "lg:max-w-none lg:px-0" : "lg:max-w-[720px]"
        } ${fillHeight ? "lg:h-full" : ""}`}
      >
        <div
          className={`relative w-full min-w-0 overflow-hidden rounded-[16px] border border-white/8 bg-[#0a0a0a] shadow-[0_10px_36px_rgba(0,0,0,0.45)] ${fillHeight ? "lg:h-full" : ""}`}
          style={{ touchAction: "pan-y" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className={`flex w-full transition-transform duration-500 ease-out ${fillHeight ? "lg:h-full" : ""}`}
            style={{ transform: `translateX(-${safeIndex * 100}%)` }}
          >
            {SLIDES.map((slide, i) => (
              <Link
                key={slide.id}
                href={slide.href || "#"}
                className={`block w-full min-w-0 shrink-0 basis-full ${fillHeight ? "lg:h-full" : ""}`}
                aria-label={slide.alt}
              >
                {typeof slide.src === "string" ? (
                  // Banner dinâmico (servido do nosso backend) — <img> simples.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    className={`h-auto w-full max-w-full object-contain ${fillHeight ? "lg:h-full lg:object-cover lg:object-center" : ""}`}
                    draggable={false}
                  />
                ) : (
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    className={`h-auto w-full max-w-full object-contain ${fillHeight ? "lg:h-full lg:object-cover lg:object-center" : ""}`}
                    priority={i === 0}
                    sizes="(max-width: 460px) 100vw, (max-width: 1040px) 720px, 1300px"
                    draggable={false}
                  />
                )}
              </Link>
            ))}
          </div>

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para o banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === safeIndex ? "w-5 bg-[#B1EB0B]" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
