"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export type HomeHeroSlide = {
  src: StaticImageData;
  alt: string;
};

type HomeHeroCarouselProps = {
  slides: readonly HomeHeroSlide[];
  /**
   * `fade` — empilha slides com `fill` + opacidade (precisa de altura no pai, ex. `h-[250px]`).
   * `slide` — faixa horizontal: uma imagem sai e a outra entra; altura vem da proporção natural (`w-full h-auto`).
   */
  mode?: "fade" | "slide";
  heightClassName?: string;
  className?: string;
  sizes?: string;
  objectPositionClassName?: string;
  intervalMs?: number;
  linkHref?: string;
  linkAriaLabel?: string;
  /** Duração da transição do slide (ms) */
  slideDurationMs?: number;
};

export function HomeHeroCarousel({
  slides,
  mode = "fade",
  heightClassName = "h-full",
  className = "",
  sizes = "(max-width: 430px) 100vw, 430px",
  objectPositionClassName = "object-[63%_center]",
  intervalMs = 5500,
  linkHref,
  linkAriaLabel = "Abrir destino do banner",
  slideDurationMs = 520,
}: HomeHeroCarouselProps) {
  const [active, setActive] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count < 2 || !intervalMs) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [count, intervalMs]);

  if (count === 0) return null;

  const overlay = (
    <>
      {linkHref ? (
        <Link
          href={linkHref}
          prefetch={false}
          className="absolute inset-0 z-2 cursor-pointer"
          aria-label={linkAriaLabel}
        >
          <span className="sr-only">{linkAriaLabel}</span>
        </Link>
      ) : null}

      {count > 1 && (
        <div
          className="pointer-events-auto absolute bottom-2.5 left-0 right-0 z-10 flex justify-center gap-1.5 px-3"
          role="group"
          aria-label="Indicadores do carrossel"
        >
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Ir para o slide ${index + 1} de ${count}`}
              aria-current={index === active ? "true" : undefined}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === active ? "w-5 bg-primary shadow-[0_0_12px_rgba(177,235,11,0.45)]" : "w-1.5 bg-white/40 hover:bg-white/60"
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActive(index);
              }}
            />
          ))}
        </div>
      )}
    </>
  );

  if (mode === "slide") {
    return (
      <div className={`relative w-full overflow-hidden ${className}`}>
        <div
          className="flex w-full will-change-transform motion-reduce:transition-none"
          style={{
            transform: `translate3d(-${active * 100}%, 0, 0)`,
            transition: `transform ${slideDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
        >
          {slides.map((slide, index) => (
            <div key={`${slide.alt}-${index}`} className="min-w-0 w-full shrink-0 basis-full">
              <Image
                src={slide.src}
                alt={slide.alt}
                width={slide.src.width}
                height={slide.src.height}
                sizes={sizes}
                className="block h-auto w-full max-w-full"
                priority={index === 0}
                draggable={false}
              />
            </div>
          ))}
        </div>
        {overlay}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${heightClassName} ${className}`}>
      {slides.map((slide, index) => (
        <div
          key={`${slide.alt}-${index}`}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${
            index === active ? "z-1 opacity-100" : "z-0 opacity-0"
          }`}
          aria-hidden={index !== active}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            className={`object-cover ${objectPositionClassName}`}
            sizes={sizes}
            priority={index === 0}
            draggable={false}
          />
        </div>
      ))}
      {overlay}
    </div>
  );
}
