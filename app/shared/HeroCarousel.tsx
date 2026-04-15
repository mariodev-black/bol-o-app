"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import banner00 from "@/app/assets/banner00.png";
import banner01 from "@/app/assets/banner01.png";
import banner02 from "@/app/assets/banner02.png";
import banner03 from "@/app/assets/banner03.png";

const SLIDES = [
  { src: banner00.src, srcDesk: banner00.src, alt: "Slide 1" },
  { src: banner01.src, srcDesk: banner01.src, alt: "Slide 2" },
  { src: banner02.src, srcDesk: banner02.src, alt: "Slide 3" },
  { src: banner03.src, srcDesk: banner03.src, alt: "Slide 4" },
];

const AUTOPLAY_INTERVAL = 5000;

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (animating) return;
      setAnimating(true);
      setCurrent(index);
      setTimeout(() => setAnimating(false), 500);
    },
    [animating]
  );

  const prev = () => goTo((current - 1 + SLIDES.length) % SLIDES.length);
  const next = useCallback(() => goTo((current + 1) % SLIDES.length), [current, goTo]);

  useEffect(() => {
    const timer = setInterval(next, AUTOPLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <div className="relative w-full overflow-hidden h-[180px] md:h-[320px] " >
      {/* Slides */}
      {SLIDES.map((slide, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          {/* mobile */}
          <img
            src={slide.src}
            alt={slide.alt}
            className="w-full h-full object-cover md:hidden"
          />
          {/* desktop */}
          <img
            src={slide.srcDesk}
            alt={slide.alt}
            className="w-full h-full object-cover hidden md:block"
          />
          {/* overlay gradiente bottom */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, transparent 40%, #0E141B 100%)",
            }}
          />
        </div>
      ))}

      {/* Botão prev */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/10"
        style={{ backgroundColor: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)" }}
        aria-label="Anterior"
      >
        <ChevronLeft className="w-4 h-4 text-white/70" />
      </button>

      {/* Botão next */}
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/10"
        style={{ backgroundColor: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)" }}
        aria-label="Próximo"
      >
        <ChevronRight className="w-4 h-4 text-white/70" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="transition-all duration-300 rounded-full"
            style={{
              width: i === current ? 24 : 8,
              height: 8,
              background:
                i === current
                  ? "linear-gradient(90deg, #FFE8BA, #D4AF37)"
                  : "rgba(255,255,255,0.3)",
            }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
