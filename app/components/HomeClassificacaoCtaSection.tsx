"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CircleHelp, Send } from "lucide-react";
import {
  getTelegramChannelUrl,
  HOME_HELP_HREF,
} from "@/lib/home-external-links";

const GREEN = "#B1EB0B";
const CARD_BG = "#111111";
const TELEGRAM_BLUE = "#2AABEE";

function HorizontalCtaCard({
  icon,
  eyebrow,
  title,
  titleColor,
  description,
  button,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  titleColor: string;
  description: ReactNode;
  button: ReactNode;
}) {
  return (
    <article
      className="flex items-stretch gap-3 rounded-[16px] border border-white/8 p-3.5"
      style={{ backgroundColor: CARD_BG }}
    >
      <div className="flex w-[52px] shrink-0 items-center justify-center">
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-[11px] font-black uppercase leading-none tracking-[0.06em] text-white/88">
          {eyebrow}
        </p>
        <h3
          className="mt-1 text-[15px] font-black uppercase leading-[1.05] tracking-[0.02em]"
          style={{ color: titleColor }}
        >
          {title}
        </h3>
        <p className="mt-1.5 text-[11px] font-medium leading-[1.45] text-white/75">
          {description}
        </p>
      </div>
      <div className="flex w-[78px] shrink-0 items-center justify-center">
        {button}
      </div>
    </article>
  );
}

export function HomeClassificacaoCtaSection({
  className = "mt-5",
}: {
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <HorizontalCtaCard
        icon={
          <Send
            className="size-11"
            strokeWidth={1.65}
            style={{ color: TELEGRAM_BLUE }}
            aria-hidden
          />
        }
        eyebrow="ENTRE NO NOSSO"
        title="CANAL DO TELEGRAM"
        titleColor={TELEGRAM_BLUE}
        description={
          <>
            Receba dicas, novidades, avisos importantes e conteúdos exclusivos do{" "}
            <strong className="font-black text-white">Bolão do Milhão!</strong>
          </>
        }
        button={
          <a
            href={getTelegramChannelUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full min-h-[72px] w-full flex-col items-center justify-center gap-1.5 rounded-[11px] px-1.5 py-2.5 text-center transition active:scale-[0.98] hover:brightness-105"
            style={{ backgroundColor: TELEGRAM_BLUE }}
          >
            <Send className="size-5 text-white" strokeWidth={2.2} aria-hidden />
            <span className="text-[10px] font-black uppercase leading-[1.15] tracking-[0.02em] text-white">
              ENTRAR
              <br />
              NO CANAL
            </span>
          </a>
        }
      />

      <HorizontalCtaCard
        icon={
          <CircleHelp
            className="size-11"
            strokeWidth={1.65}
            style={{ color: GREEN }}
            aria-hidden
          />
        }
        eyebrow="PRECISA DE AJUDA?"
        title="CENTRAL DE AJUDA"
        titleColor={GREEN}
        description="Tire suas dúvidas, veja como funciona e encontre respostas para tudo."
        button={
          <Link
            href={HOME_HELP_HREF}
            className="flex h-full min-h-[72px] w-full flex-col items-center justify-center gap-1.5 rounded-[11px] px-1.5 py-2.5 text-center transition active:scale-[0.98] hover:brightness-105"
            style={{ backgroundColor: GREEN }}
          >
            <span
              className="flex size-6 items-center justify-center rounded-full bg-[#0E141B] text-[13px] font-black leading-none"
              style={{ color: GREEN }}
              aria-hidden
            >
              ?
            </span>
            <span className="text-[10px] font-black uppercase leading-[1.15] tracking-[0.02em] text-[#0E141B]">
              ACESSAR
              <br />
              AJUDA
            </span>
          </Link>
        }
      />
    </div>
  );
}
