"use client";

import Link from "next/link";
import { ClipboardList, HelpCircle, Target, Trophy } from "lucide-react";
import { HOME_HELP_HREF } from "@/lib/home-external-links";

const GREEN = "#B1EB0B";
const CARD_BG = "#111111";
const BORDER = "rgba(255,255,255,0.07)";

type EduCard = {
  icon: React.ElementType;
  title: string;
  description: string;
  ctaLabel: string;
  href?: string;
  action?: "scoring";
};

const CARDS: EduCard[] = [
  {
    icon: ClipboardList,
    title: "COMO FUNCIONA?",
    description:
      "Dê seus palpites, acumule pontos e suba no ranking. Quanto mais assertos, mais perto do prêmio!",
    ctaLabel: "VER REGRAS",
    href: "/regulamento",
  },
  {
    icon: Target,
    title: "SISTEMA DE PONTUAÇÃO",
    description:
      "Pontue acertando placares, vencedores e gols. Bônus extras para quem acertar o placar exato!",
    ctaLabel: "COMO PONTUA",
    action: "scoring",
  },
  {
    icon: Trophy,
    title: "SISTEMA DE PREMIAÇÃO",
    description:
      "Os melhores colocados ganham prêmios em dinheiro via PIX! Simples, justo e transparente.",
    ctaLabel: "VER PREMIAÇÕES",
    href: "/premiacao",
  },
  {
    icon: HelpCircle,
    title: "CENTRAL DE AJUDA",
    description:
      "Tire dúvidas, veja tutoriais e fale com nosso suporte. Estamos aqui para ajudar!",
    ctaLabel: "ACESSAR AJUDA",
    href: HOME_HELP_HREF,
  },
];

function Card({
  card,
  onScoring,
}: {
  card: EduCard;
  onScoring?: () => void;
}) {
  const Icon = card.icon;
  return (
    <article
      className="flex flex-col rounded-[14px] border p-4"
      style={{ background: CARD_BG, borderColor: BORDER }}
    >
      <Icon className="size-6" style={{ color: GREEN }} strokeWidth={1.9} aria-hidden />
      <h3 className="mt-3 text-[13px] font-black uppercase leading-tight tracking-[0.02em] text-white">
        {card.title}
      </h3>
      <p className="mt-2 flex-1 text-[12px] font-medium leading-[1.45] text-white/60">
        {card.description}
      </p>
      {card.action === "scoring" ? (
        <button
          type="button"
          onClick={onScoring}
          className="mt-3 inline-flex h-8 w-fit items-center rounded-[8px] px-3 text-[10px] font-black uppercase tracking-wide transition hover:brightness-110 active:scale-[0.98]"
          style={{ background: GREEN, color: "#0E141B" }}
        >
          {card.ctaLabel}
        </button>
      ) : (
        <Link
          href={card.href ?? "#"}
          className="mt-3 inline-flex h-8 w-fit items-center rounded-[8px] px-3 text-[10px] font-black uppercase tracking-wide transition hover:brightness-110 active:scale-[0.98]"
          style={{ background: GREEN, color: "#0E141B" }}
        >
          {card.ctaLabel}
        </Link>
      )}
    </article>
  );
}

export function HomeDesktopEducationCards({
  className = "",
  onScoring,
}: {
  className?: string;
  onScoring?: () => void;
}) {
  return (
    <section className={className} aria-label="Como funciona">
      <div className="grid grid-cols-4 gap-4">
        {CARDS.map((card) => (
          <Card key={card.title} card={card} onScoring={onScoring} />
        ))}
      </div>
    </section>
  );
}
