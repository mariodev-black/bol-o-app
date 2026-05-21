"use client";

import {
  SCORING_PRACTICAL_EXAMPLES,
  SCORING_RULES_EXPLAINER,
  summarizeScoringExample,
} from "@/lib/scoring/scoring-explainer";
import { ExplainerModal } from "@/app/shared/ExplainerModal";

const GREEN = "#B1EB0B";

export function ScoringExplainerModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ExplainerModal
      open={open}
      onOpenChange={onOpenChange}
      title="Como funciona a pontuação?"
      subtitle="Cada jogo vale até 6 pontos no ranking."
      titleId="scoring-explainer-modal-title"
      maxWidthClass="max-w-[440px]"
      readable
      footer={
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full min-h-[50px] rounded-[11px] text-[17px] font-semibold text-white/75 transition hover:text-white"
        >
          Fechar
        </button>
      }
    >
      <ul className="space-y-3">
        {SCORING_RULES_EXPLAINER.map((rule) => (
          <li
            key={rule.title}
            className="flex items-start justify-between gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3.5 py-3"
          >
            <div className="min-w-0">
              <p className="text-[16px] font-bold leading-snug text-white min-[380px]:text-[17px]">
                {rule.title}
              </p>
              {rule.subtitle ? (
                <p className="mt-1 text-[14px] font-medium leading-snug text-white/72">
                  {rule.subtitle}
                </p>
              ) : null}
            </div>
            <span
              className="shrink-0 rounded-md px-2.5 py-1.5 text-[14px] font-black tabular-nums min-[380px]:text-[15px]"
              style={{ background: `${GREEN}28`, color: GREEN }}
            >
              {rule.pointsLabel}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[13px] font-black uppercase tracking-[0.12em] text-white/70">
        Exemplos práticos
      </p>

      <ul className="mt-3.5 space-y-3.5">
        {SCORING_PRACTICAL_EXAMPLES.map((ex) => {
          const summary = summarizeScoringExample(ex);
          const won = summary.points > 0;
          return (
            <li
              key={ex.id}
              className="overflow-hidden rounded-[11px] border border-white/10 bg-white/[0.04]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
                <span className="text-[12px] font-black uppercase tracking-[0.06em] text-white/75 min-[380px]:text-[13px]">
                  {ex.tag}
                </span>
                <span
                  className="text-[14px] font-black tabular-nums leading-tight min-[380px]:text-[15px]"
                  style={{ color: won ? GREEN : "rgba(255,255,255,0.65)" }}
                >
                  {summary.resultLine}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-px bg-white/8">
                <div className="bg-[#111111] px-3.5 py-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/65 min-[380px]:text-[12px]">
                    Seu palpite
                  </p>
                  <p className="mt-1.5 text-[22px] font-black tabular-nums leading-none text-white min-[380px]:text-[24px]">
                    {summary.predLabel}
                  </p>
                </div>
                <div className="bg-[#111111] px-3.5 py-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/65 min-[380px]:text-[12px]">
                    Resultado
                  </p>
                  <p className="mt-1.5 text-[22px] font-black tabular-nums leading-none text-white min-[380px]:text-[24px]">
                    {summary.realLabel}
                  </p>
                </div>
              </div>

              <p className="px-3.5 py-3 text-[14px] font-medium leading-relaxed text-white/78 min-[380px]:text-[15px]">
                {summary.detail}
              </p>
            </li>
          );
        })}
      </ul>

      <p
        className="mt-5 rounded-[10px] border px-3.5 py-3 text-[14px] font-medium leading-relaxed text-white/78 min-[380px]:text-[15px]"
        style={{ borderColor: `${GREEN}40`, background: `${GREEN}12` }}
      >
        <strong className="font-bold text-white">Dica:</strong> durante os jogos,
        os pontos podem mudar ao vivo conforme o placar — o ranking atualiza na hora.
      </p>
    </ExplainerModal>
  );
}
