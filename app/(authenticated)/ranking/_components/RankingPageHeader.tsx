"use client";

import { RANKING_GREEN } from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";

export function RankingPageHeader({
  eyebrow,
  title,
  titleAccent,
  description,
}: {
  eyebrow: string;
  title: string;
  titleAccent?: string;
  description: string;
}) {
  return (
    <header className="mt-2 text-center">
      <p
        className="text-[16px] font-black uppercase leading-none tracking-[0.25em]"
        style={{ color: RANKING_GREEN }}
      >
        {eyebrow}
      </p>
      <h1 className="mt-2 text-[34px] font-black uppercase leading-none tracking-[-0.055em] text-white">
        {title}{" "}
        {titleAccent ? (
          <span style={{ color: RANKING_GREEN }}>{titleAccent}</span>
        ) : null}
      </h1>
      <p className="mx-auto mt-3 max-w-[340px] text-[18px] font-medium leading-[1.5] text-white/75 min-[380px]:text-[19px]">
        {description}
      </p>
    </header>
  );
}
