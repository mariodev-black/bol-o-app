"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RANKING_PALPITES_STEPS } from "@/app/(authenticated)/ranking/_components/ranking-flow";
import { RANKING_YELLOW } from "@/app/(authenticated)/ranking/_components/ranking-scope-ui";
import { ExplainerModal } from "@/app/shared/ExplainerModal";

export function RankingPalpitesStepsModal({
  open,
  onOpenChange,
  palpitesHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  palpitesHref: string;
}) {
  return (
    <ExplainerModal
      open={open}
      onOpenChange={onOpenChange}
      title="Como funciona?"
      subtitle="É rápido e fácil!"
      titleId="ranking-steps-modal-title"
      footer={
        <>
          <Link
            href={palpitesHref}
            onClick={() => onOpenChange(false)}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[11px] bg-white text-[17px] font-black uppercase tracking-[0.04em] text-[#0E141B] transition hover:bg-white/92 active:scale-[0.98] min-[380px]:min-h-[54px] min-[380px]:text-[18px]"
          >
            Fazer palpites
            <ArrowRight className="size-5 shrink-0" strokeWidth={2.6} aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-3 w-full min-h-[44px] text-[16px] font-semibold text-white/55 transition hover:text-white/80"
          >
            Fechar
          </button>
        </>
      }
    >
      <ol className="space-y-4">
        {RANKING_PALPITES_STEPS.map((label, index) => (
          <li key={label} className="flex items-start gap-3.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-[14px] font-black text-[#0E141B]"
              style={{ background: RANKING_YELLOW }}
              aria-hidden
            >
              {index + 1}
            </span>
            <span className="pt-0.5 text-[17px] font-semibold leading-snug text-white/80 min-[380px]:text-[18px]">
              {label}
            </span>
          </li>
        ))}
      </ol>
    </ExplainerModal>
  );
}
