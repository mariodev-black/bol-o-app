"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";

export type HomeHeroSlide = {
  src: StaticImageData;
  alt: string;
  /** Destino ao clicar na área do banner neste slide */
  href: string;
  /** Texto curto para leitores de tela (opcional) */
  linkAriaLabel?: string;
};

type HomeHeroCarouselProps = {
  slides: readonly HomeHeroSlide[];
  /**
   * `fade` — empilha slides com opacidade (altura fixa no pai).
   * `slide` — slide full-width (legado).
   * `peek` — cards com borda visível do próximo slide + animação de entrada.
   */
  mode?: "fade" | "slide" | "peek";
  heightClassName?: string;
  className?: string;
  sizes?: string;
  objectPositionClassName?: string;
  intervalMs?: number;
  slideDurationMs?: number;
  /** Largura de cada card em relação ao container (0–1). Default 0.88 */
  peekSlideRatio?: number;
  /** Botões anterior / próximo (default: true se houver mais de um slide) */
  showNavigation?: boolean;
};

const PEEK_GAP_PX = 12;
const PEEK_PAD_PX = 16;
const navBtnClass =
  "pointer-events-auto absolute top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/14 bg-black/60 text-primary shadow-[0_10px_28px_rgba(0,0,0,0.5)] backdrop-blur-md transition-[transform,colors,box-shadow,border-color] hover:border-primary/45 hover:bg-black/78 hover:shadow-[0_12px_32px_rgba(177,235,11,0.12)] active:scale-[0.93] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-11 sm:w-11";

export function HomeHeroCarousel({
  slides,
  mode = "peek",
  heightClassName = "h-full",
  className = "",
  sizes = "(max-width: 430px) 100vw, 430px",
  objectPositionClassName = "object-[63%_center]",
  intervalMs = 5500,
  slideDurationMs = 520,
  peekSlideRatio = 0.88,
  showNavigation = true,
}: HomeHeroCarouselProps) {
  const [active, setActive] = useState(0);
  const [enterGen, setEnterGen] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = slides.length;
  const activeSlide = slides[active];

  const goPrev = useCallback(() => {
    setActive((i) => (i - 1 + count) % count);
  }, [count]);

  const goNext = useCallback(() => {
    setActive((i) => (i + 1) % count);
  }, [count]);

  useLayoutEffect(() => {
    if (mode !== "peek") return;
    const el = rootRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      setSlideWidth(Math.round((w - PEEK_PAD_PX) * peekSlideRatio));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, peekSlideRatio]);

  useEffect(() => {
    setEnterGen((g) => g + 1);
  }, [active]);

  useEffect(() => {
    if (count < 2 || !intervalMs) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [count, intervalMs]);

  if (count === 0) return null;

  const canNavigate = count > 1 && showNavigation;
  const slideStep = slideWidth > 0 ? slideWidth + PEEK_GAP_PX : 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!canNavigate) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    }
  };

  const dots = count > 1 && showNavigation && (
    <div
      className="pointer-events-auto absolute bottom-2.5 left-0 right-0 z-10 flex justify-center gap-1.5 px-10 sm:px-12"
      role="tablist"
      aria-label="Indicadores do carrossel"
    >
      {slides.map((_, index) => (
        <button
          key={index}
          type="button"
          role="tab"
          aria-selected={index === active}
          aria-label={`Slide ${index + 1} de ${count}`}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            index === active
              ? "w-5 bg-primary shadow-[0_0_12px_rgba(177,235,11,0.45)]"
              : "w-1.5 bg-white/40 hover:bg-white/60"
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActive(index);
          }}
        />
      ))}
    </div>
  );

  const navButtons = canNavigate && (
    <>
      <button
        type="button"
        aria-label="Slide anterior"
        className={`${navBtnClass} left-2 sm:left-3`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          goPrev();
        }}
      >
        <ChevronLeft className="size-5 sm:size-[22px]" strokeWidth={2.4} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Próximo slide"
        className={`${navBtnClass} right-2 sm:right-3`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          goNext();
        }}
      >
        <ChevronRight className="size-5 sm:size-[22px]" strokeWidth={2.4} aria-hidden />
      </button>
    </>
  );

  const regionProps = {
    role: "region" as const,
    "aria-roledescription": "carrossel",
    "aria-label": "Destaques em imagens",
    tabIndex: canNavigate ? (0 as const) : undefined,
    onKeyDown: handleKeyDown,
  };

  if (mode === "peek") {
    return (
      <div
        ref={rootRef}
        className={`home-hero-peek relative w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${className}`}
        {...regionProps}
      >
        <div
          className="flex will-change-transform motion-reduce:transition-none"
          style={{
            gap: PEEK_GAP_PX,
            paddingLeft: PEEK_PAD_PX,
            transform:
              slideStep > 0
                ? `translate3d(-${active * slideStep}px, 0, 0)`
                : undefined,
            transition: `transform ${slideDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
        >
          {slides.map((slide, index) => {
            const isActive = index === active;
            const slideBasis =
              slideWidth > 0 ? `${slideWidth}px` : `${peekSlideRatio * 100}%`;

            const card = (
              <div
                className={`relative w-full overflow-hidden rounded-[18px] border bg-black transition-[transform,opacity,border-color] duration-500 motion-reduce:transition-none ${
                  isActive
                    ? "border-white/14 opacity-100"
                    : "border-white/8 opacity-90 scale-[0.985]"
                }`}
              >
                <div
                  key={isActive ? `enter-${enterGen}` : `idle-${index}`}
                  className={
                    isActive
                      ? "animate-home-hero-slide-in motion-reduce:animate-none"
                      : undefined
                  }
                >
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
              </div>
            );

            return (
              <article
                key={`${slide.alt}-${index}`}
                className="relative shrink-0"
                style={{ width: slideBasis }}
                aria-hidden={!isActive}
              >
                {slide.href ? (
                  <Link
                    href={slide.href}
                    prefetch={false}
                    className="block rounded-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label={slide.linkAriaLabel ?? `Abrir: ${slide.href}`}
                    tabIndex={isActive ? 0 : -1}
                  >
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </article>
            );
          })}
        </div>

        {navButtons}
        {dots}
      </div>
    );
  }

  if (mode === "slide") {
    return (
      <div
        className={`relative w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${className}`}
        {...regionProps}
      >
        <div
          className="flex w-full will-change-transform motion-reduce:transition-none"
          style={{
            transform: `translate3d(-${active * 100}%, 0, 0)`,
            transition: `transform ${slideDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
        >
          {slides.map((slide, index) => (
            <div
              key={`${slide.alt}-${index}`}
              className="min-w-0 w-full shrink-0 basis-full"
              aria-hidden={index !== active}
            >
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

        {activeSlide.href ? (
          <Link
            href={activeSlide.href}
            prefetch={false}
            className="absolute inset-0 z-2 cursor-pointer"
            aria-label={activeSlide.linkAriaLabel ?? `Abrir: ${activeSlide.href}`}
          >
            <span className="sr-only">
              {activeSlide.linkAriaLabel ?? activeSlide.alt}
            </span>
          </Link>
        ) : null}

        {navButtons}
        {dots}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${heightClassName} ${className}`}
      {...regionProps}
    >
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

      {activeSlide.href ? (
        <Link
          href={activeSlide.href}
          prefetch={false}
          className="absolute inset-0 z-2 cursor-pointer"
          aria-label={activeSlide.linkAriaLabel ?? `Abrir: ${activeSlide.href}`}
        >
          <span className="sr-only">
            {activeSlide.linkAriaLabel ?? activeSlide.alt}
          </span>
        </Link>
      ) : null}

      {navButtons}
      {dots}
    </div>
  );
}
