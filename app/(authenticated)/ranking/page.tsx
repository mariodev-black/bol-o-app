"use client";

import { Suspense } from "react";
import { RankingExperience } from "@/app/(authenticated)/ranking/_components/RankingExperience";

export default function RankingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black pb-28 font-helvetica-now-display text-white">
          <div className="mx-auto w-full px-4 pt-6">
            <div className="h-32 animate-pulse rounded-2xl bg-white/8" />
            <div className="mt-6 h-24 animate-pulse rounded-2xl bg-white/8" />
          </div>
        </main>
      }
    >
      <RankingExperience />
    </Suspense>
  );
}
