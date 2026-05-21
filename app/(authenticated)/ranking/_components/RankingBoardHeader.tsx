"use client";

import { ArrowLeft } from "lucide-react";
import {
  RANKING_CARD_BG,
  ScopeLogoLarge,
  scopeCardHeaderParts,
  scopeRoundLabel,
  scopeSelectLines,
} from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";
import type { RankingScopeOption } from "@/lib/ranking/scopes-shared";

export function RankingBoardHeader({
  scope,
  onBack,
}: {
  scope: RankingScopeOption;
  onBack: () => void;
}) {
  const { primary } = scopeSelectLines(scope);
  const header = scopeCardHeaderParts(scope, primary);
  const { secondary } = scopeSelectLines(scope);
  const roundLabel = scope.mode === "extra" ? null : scopeRoundLabel(scope);

  return (
    <header className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="-ml-0.5 inline-flex items-center gap-1.5 py-1 text-[14px] font-semibold text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:opacity-80"
        aria-label="Voltar para escolher outro bolão"
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2.4} aria-hidden />
        Voltar aos bolões
      </button>

      <section
        className="overflow-hidden rounded-[16px] border px-4 py-4"
        style={{
          background: RANKING_CARD_BG,
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex w-[72px] shrink-0 items-center justify-center">
            <ScopeLogoLarge option={scope} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/65">
              {header.category}
            </p>
            <h1 className="mt-1 text-[20px] font-black uppercase leading-tight text-white min-[380px]:text-[22px]">
              {header.title}
            </h1>
            {roundLabel ? (
              <p className="mt-2 text-[15px] font-black uppercase tracking-wide text-primary min-[380px]:text-[16px]">
                {roundLabel}
              </p>
            ) : null}
            {secondary ? (
              <p className="mt-1.5 text-[14px] font-semibold text-white/70 min-[380px]:text-[15px]">
                {secondary}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </header>
  );
}
