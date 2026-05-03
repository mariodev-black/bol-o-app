"use client";

import { useEffect, useRef, useState } from "react";

export type ScoreRuleItem = {
  badge: string;
  badgeSub?: string;
  badgeClass: string;
  points: string;
};

type ScoreRulesCardsProps = {
  rules: ScoreRuleItem[];
  accents: readonly string[];
  heroSrc: string;
};

export function ScoreRulesCards({ rules, accents, heroSrc }: ScoreRulesCardsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }

    const el = listRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <ul
      ref={listRef}
      id="regras-pontuacao"
      className={`flex flex-col gap-4 md:gap-5${revealed ? " score-rules-revealed" : ""}`}
    >
      {rules.map(({ badge, badgeSub, badgeClass, points }, idx) => (
        <li key={badge}>
          <div
            className="score-rule-card score-rule-card-animate group relative flex flex-col gap-4 overflow-hidden rounded-[18.49px] p-5 pl-6 md:flex-row md:items-center md:justify-between md:rounded-[29.16px] md:p-6 md:pl-7"
            style={{ animationDelay: `${idx * 90}ms` }}
          >
            <div
              className="score-rule-card-glow pointer-events-none z-[1]"
              aria-hidden
            />
            {idx === 0 ? (
              <>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center opacity-[0.32]"
                  style={{ backgroundImage: `url(${heroSrc})` }}
                />
                <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-[#121820]/95 via-[#0d141c]/96 to-[#080c12]/98" />
              </>
            ) : null}
            <div
              aria-hidden
              className="absolute bottom-5 left-0 top-5 z-[2] w-1 rounded-full shadow-[0_0_16px_rgba(177,235,11,0.25)]"
              style={{
                background: accents[idx] ?? accents[0],
              }}
            />
            <div className="relative z-10 flex flex-col items-start gap-1 pl-2 md:pl-3">
              {badgeSub ? (
                <div className="rounded-full border border-white/12 bg-[#0f291c]/95 px-4 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[2px]">
                  <span className="block text-xs font-bold uppercase leading-tight text-white">
                    {badge}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-medium normal-case text-white/90">
                    {badgeSub}
                  </span>
                </div>
              ) : (
                <span className={badgeClass}>{badge}</span>
              )}
            </div>
            <p
              className={`relative z-10 shrink-0 tabular-nums text-white ${
                idx === 4
                  ? "text-xl font-bold md:text-2xl"
                  : "text-2xl font-bold md:text-3xl"
              }`}
            >
              {points}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
