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
      subtitle="Cada palpite pode render até 6 pontos."
      titleId="scoring-explainer-modal-title"
      maxWidthClass="max-w-[440px]"
      readable
      footer={
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full min-h-[44px] rounded-[11px] border border-white/10 bg-[#111111] text-[15px] font-bold text-white/85 transition hover:border-white/18 hover:bg-[#161616] hover:text-white"
        >
          Fechar
        </button>
      }
    >
      <ul className="space-y-2">
        {SCORING_RULES_EXPLAINER.map((rule) => (
          <li
            key={rule.title}
            className="flex items-start justify-between gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-[14px] font-bold uppercase leading-snug tracking-wide text-white min-[380px]:text-[15px]">
                {rule.title}
              </p>
              {rule.detail ? (
                <p className="mt-0.5 text-[12px] font-medium leading-snug text-white/65 min-[380px]:text-[13px]">
                  {rule.detail}
                </p>
              ) : null}
            </div>
            <span
              className="shrink-0 rounded-md px-2 py-1 text-[13px] font-black tabular-nums min-[380px]:text-[14px]"
              style={{ background: `${GREEN}28`, color: GREEN }}
            >
              {rule.pointsLabel}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[12px] font-black uppercase tracking-[0.12em] text-white/70">
        Exemplos práticos
      </p>

      <ul className="mt-2.5 space-y-2.5">
        {SCORING_PRACTICAL_EXAMPLES.map((ex) => {
          const summary = summarizeScoringExample(ex);
          const won = summary.points > 0;
          return (
            <li
              key={ex.id}
              className="overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.04]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3 py-2">
                <span className="text-[11px] font-black uppercase tracking-[0.06em] text-white/75 min-[380px]:text-[12px]">
                  {ex.tag}
                </span>
                <span
                  className="text-[13px] font-black tabular-nums leading-tight min-[380px]:text-[14px]"
                  style={{ color: won ? GREEN : "rgba(255,255,255,0.65)" }}
                >
                  {summary.resultLine}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-px bg-white/8">
                <div className="bg-[#111111] px-3 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/60 min-[380px]:text-[11px]">
                    Seu palpite
                  </p>
                  <p className="mt-1 text-[20px] font-black tabular-nums leading-none text-white min-[380px]:text-[22px]">
                    {summary.predLabel}
                  </p>
                </div>
                <div className="bg-[#111111] px-3 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/60 min-[380px]:text-[11px]">
                    Resultado
                  </p>
                  <p className="mt-1 text-[20px] font-black tabular-nums leading-none text-white min-[380px]:text-[22px]">
                    {summary.realLabel}
                  </p>
                </div>
              </div>

              <p className="px-3 py-2 text-[12px] font-medium leading-snug text-white/72 min-[380px]:text-[13px]">
                {summary.detail}
              </p>
            </li>
          );
        })}
      </ul>

      <p
        className="mt-4 rounded-[10px] border px-3 py-2.5 text-[12px] font-medium leading-snug text-white/72 min-[380px]:text-[13px]"
        style={{ borderColor: `${GREEN}40`, background: `${GREEN}12` }}
      >
        <strong className="font-bold text-white">Dica:</strong> durante os jogos,
        os pontos podem mudar ao vivo conforme o placar — o ranking atualiza na hora.
      </p>
    </ExplainerModal>
  );
}
