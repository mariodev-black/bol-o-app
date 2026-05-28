"use client";

import type { ReactNode } from "react";
import Link from "next/link";

const GREEN = "#B1EB0B";
const CARD_BG = "#111111";
const NESTED_CARD_BG = "#161616";
const RULES_HREF = "/regulamento";

const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: "FAÇA SEUS PALPITES",
    body: "Escolha os resultados dos jogos da Copa do Mundo.",
  },
  {
    step: 2,
    title: "ACERTE E SOME PONTOS",
    body: "Cada acerto te dá pontos na competição.",
  },
  {
    step: 3,
    title: "ERROU? SEGUE VIVO",
    body: "Errou um jogo? Você não perde nada e continua na disputa.",
  },
  {
    step: 4,
    title: "SUBA NO RANKING",
    body: (
      <>
        E dispute mais de <strong className="font-black text-white">1 Milhão</strong>{" "}
        em <strong className="font-black text-white">Premiações</strong>
      </>
    ),
  },
] as const;

const SCORE_RULES = [
  {
    points: "+6 pts",
    label: "PLACAR EXATO",
    footer: false,
  },
  {
    points: "+4 pts",
    label: "VENCEDOR + GOL DE UM TIME",
    footer: true,
  },
  {
    points: "+1 pt",
    label: "GOLS DE UM TIME",
    footer: false,
  },
  {
    points: "+3 pt",
    label: "ACERTAR VENCEDOR OU EMPATE",
    footer: true,
  },
] as const;

function SectionRulesLink() {
  return (
    <Link
      href={RULES_HREF}
      className="shrink-0 text-[14px] font-black uppercase tracking-wide transition-opacity hover:opacity-90"
      style={{ color: GREEN }}
    >
      VER REGRAS &gt;
    </Link>
  );
}

function SectionVerMaisButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="relative z-10 shrink-0 cursor-pointer text-[14px] font-black uppercase tracking-wide transition-opacity hover:opacity-90 active:opacity-80"
      style={{ color: GREEN }}
      aria-haspopup="dialog"
      aria-controls="scoring-explainer-modal-title"
    >
      VER MAIS &gt;
    </button>
  );
}

function HowItWorksStepCard({
  step,
  title,
  body,
}: {
  step: number;
  title: string;
  body: ReactNode;
}) {
  return (
    <article
      className="flex min-h-[148px] min-w-0 flex-col items-center justify-center rounded-[14px] border border-white/8 px-3.5 py-4 text-center"
      style={{ backgroundColor: CARD_BG }}
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-[17px] font-black leading-none text-[#0E141B]"
        style={{ backgroundColor: GREEN }}
        aria-hidden
      >
        {step}
      </span>
      <h3 className="mt-3 text-pretty text-[13px] font-black uppercase leading-[1.2] tracking-[0.02em] text-white">
        {title}
      </h3>
      <p className="mt-2 text-pretty text-[12px] font-medium leading-[1.45] text-white/78">
        {body}
      </p>
    </article>
  );
}

function ScoreRuleCard({
  points,
  label,
  footer,
}: {
  points: string;
  label: string;
  footer: boolean;
}) {
  return (
    <article
      className="flex min-h-[108px] min-w-0 flex-col overflow-hidden rounded-[12px] border border-white/6"
      style={{ backgroundColor: NESTED_CARD_BG }}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-3 py-4 text-center">
        <p
          className="text-[28px] font-black leading-none tracking-tight"
          style={{ color: GREEN }}
        >
          {points}
        </p>
        <p className="mt-2.5 text-pretty text-[12px] font-black uppercase leading-tight tracking-[0.02em] text-white">
          {label}
        </p>
      </div>
      {footer ? (
        <p
          className="py-2 text-center text-[10px] font-black uppercase leading-none tracking-[0.04em] text-[#0E141B]"
          style={{ backgroundColor: GREEN }}
        >
          SEM PLACAR EXATO
        </p>
      ) : null}
    </article>
  );
}

export function HomeComoFuncionaPontuacaoSection({
  className = "mt-5",
  onVerMaisPontuacao,
}: {
  className?: string;
  onVerMaisPontuacao?: () => void;
}) {
  return (
    <div className={className}>
      <section aria-labelledby="como-funciona-home-heading">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2
            id="como-funciona-home-heading"
            className="text-[16px] font-black uppercase tracking-[0.04em] text-white"
          >
            COMO FUNCIONA
          </h2>
          <SectionRulesLink />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {HOW_IT_WORKS_STEPS.map(({ step, title, body }) => (
            <HowItWorksStepCard key={step} step={step} title={title} body={body} />
          ))}
        </div>
      </section>

      <section
        className="mt-5"
        aria-labelledby="sistema-pontuacao-home-heading"
      >
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2
            id="sistema-pontuacao-home-heading"
            className="text-[16px] font-black uppercase tracking-[0.04em] text-white"
          >
            SISTEMA DE PONTUAÇÃO
          </h2>
          <SectionVerMaisButton onClick={() => onVerMaisPontuacao?.()} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SCORE_RULES.map((rule) => (
            <ScoreRuleCard key={rule.label} {...rule} />
          ))}
        </div>
      </section>
    </div>
  );
}
