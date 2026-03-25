"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Check,
  FileText,
  HelpCircle,
  Scale,
} from "lucide-react";

const BG = "#060B14";
const CARD = "#0A0E19";
const GOLD = "#D4AF37";
const GOLD_MID = "#FFE8BA";

const LEGAL_NAV = [
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/termos", label: "Termos de Uso" },
  { href: "#", label: "Política de Cookies" },
  { href: "#", label: "Regulamento do Bolão" },
  { href: "#", label: "LGPD — Seus direitos" },
] as const;

const SECTION_ACCENTS = [
  { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.35)", icon: "#60A5FA" },
  { bg: "rgba(34, 197, 94, 0.12)", border: "rgba(34, 197, 94, 0.3)", icon: "#4ADE80" },
  { bg: "rgba(249, 115, 22, 0.12)", border: "rgba(249, 115, 22, 0.3)", icon: "#FB923C" },
  { bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.3)", icon: "#F87171" },
  { bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.3)", icon: "#C084FC" },
  { bg: "rgba(180, 83, 9, 0.15)", border: "rgba(180, 83, 9, 0.35)", icon: "#D97706" },
  { bg: "rgba(20, 184, 166, 0.12)", border: "rgba(20, 184, 166, 0.3)", icon: "#2DD4BF" },
  { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.28)", icon: "#34D399" },
  { bg: "rgba(234, 179, 8, 0.14)", border: "rgba(234, 179, 8, 0.35)", icon: "#FACC15" },
] as const;

const SECTIONS: Array<{ title: string; preview: string; body: string[] }> = [
  {
    title: "Definições e aceitação",
    preview: "O que são estes termos e o que você aceita ao usar a plataforma.",
    body: [
      "Ao acessar ou usar o Bolão do Milhão, você declara ter lido e concordado com estes Termos de Uso e com a Política de Privacidade.",
      "Se você não concordar, não deve utilizar a plataforma. Podemos atualizar estes termos; o uso continuado após alterações constitui nova aceitação, salvo disposição legal em contrário.",
    ],
  },
  {
    title: "Elegibilidade e cadastro",
    preview: "Idade mínima, veracidade dos dados e segurança da conta.",
    body: [
      "É necessário ter 18 anos ou mais e capacidade civil plena para participar.",
      "Você se compromete a fornecer informações verdadeiras e manter seus dados de login em sigilo. Atividades realizadas na sua conta são de sua responsabilidade.",
    ],
  },
  {
    title: "Uso do serviço e conduta",
    preview: "Uso permitido, proibições e possíveis sanções.",
    body: [
      "O serviço destina-se à participação em bolões e funcionalidades relacionadas, de forma lícita e conforme o regulamento de cada campanha.",
      "É proibido fraudar resultados, criar múltiplas contas para burlar regras, usar bots ou interferir na segurança do sistema. Infrações podem levar a suspensão ou encerramento da conta.",
    ],
  },
  {
    title: "Pagamentos e premiações",
    preview: "Tickets, condições de pagamento e premiações.",
    body: [
      "Valores, formas de pagamento e condições de premiação seguem o regulamento vigente de cada bolão e as comunicações oficiais da plataforma.",
      "Premiações estão sujeitas à conferência de resultados e à documentação exigida. O não cumprimento de prazos ou requisitos pode impedir o recebimento.",
    ],
  },
  {
    title: "Propriedade intelectual",
    preview: "Marcas, layout, textos e conteúdo da plataforma.",
    body: [
      "Todo o conteúdo do Bolão do Milhão (marcas, logos, textos, layout, software) é protegido por lei. É vedada cópia, engenharia reversa ou uso comercial não autorizado.",
    ],
  },
  {
    title: "Limitação de responsabilidade",
    preview: "Indisponibilidade, terceiros e danos indiretos.",
    body: [
      "Empregamos esforços para manter o serviço disponível, mas não garantimos operação ininterrupta. Não nos responsabilizamos por danos indiretos, lucros cessantes ou falhas de terceiros (operadoras, instituições financeiras, internet).",
      "O uso de links externos é por sua conta e risco.",
    ],
  },
  {
    title: "Privacidade e dados",
    preview: "Tratamento de dados em conformidade com a LGPD.",
    body: [
      "O tratamento de dados pessoais segue nossa Política de Privacidade, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).",
    ],
  },
  {
    title: "Alterações destes termos",
    preview: "Como comunicamos mudanças e vigência.",
    body: [
      "Podemos alterar estes Termos de Uso a qualquer momento. Publicaremos a versão atualizada na plataforma com indicação da data de vigência.",
      "Recomendamos revisar periodicamente esta página.",
    ],
  },
  {
    title: "Contato e foro",
    preview: "Canais de atendimento e legislação aplicável.",
    body: [
      "Dúvidas podem ser enviadas pelos canais oficiais indicados no site ou no aplicativo.",
      "Quando aplicável o Código de Defesa do Consumidor, fica eleito o foro do domicílio do consumidor.",
    ],
  },
];

export default function TermosPage() {
  const [openMobile, setOpenMobile] = useState<number | null>(0);
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="min-h-screen pb-32 lg:pb-16" style={{ backgroundColor: BG }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0" aria-hidden>
        <div
          className="absolute -top-1/4 -right-1/4 w-[72%] h-[58%]"
          style={{
            background:
              "radial-gradient(ellipse 75% 65% at 78% 18%, rgba(255, 232, 186, 0.14) 0%, transparent 68%)",
          }}
        />
        <div
          className="absolute -bottom-1/4 -left-1/4 w-[68%] h-[52%]"
          style={{
            background:
              "radial-gradient(ellipse 70% 58% at 18% 82%, rgba(249, 115, 22, 0.11) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-6 lg:pt-10 lg:px-8">
        {/* Mobile: marca + título */}
        <div className="lg:hidden text-center mb-6">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em] mb-2"
            style={{ color: GOLD_MID }}
          >
            Bolão do Milhão
          </p>
          <h1 className="text-[26px] font-black text-white tracking-tight leading-tight">
            Termos de Uso
          </h1>
        </div>

        {/* Desktop: título + meta */}
        <div className="hidden lg:flex items-start gap-4 mb-10">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(212, 175, 55, 0.15)",
              border: "1px solid rgba(212, 175, 55, 0.35)",
            }}
          >
            <Scale className="w-6 h-6" style={{ color: GOLD }} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[32px] font-black text-white tracking-tight leading-tight">
              Termos de Uso
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              Versão 2.1 · atualizado em 24 de março de 2026
            </p>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(220px,260px)_1fr] lg:gap-10 xl:gap-14">
          {/* Sidebar — desktop */}
          <aside className="hidden lg:flex flex-col gap-6">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Menu
              </p>
              <nav className="flex flex-col gap-0.5">
                {LEGAL_NAV.map((item) => {
                  const active = item.href === "/termos";
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="block rounded-lg text-[13px] font-semibold transition-colors py-2.5 pl-3 pr-3 -ml-px"
                      style={{
                        background: active ? "rgba(59, 130, 246, 0.14)" : "transparent",
                        color: active ? "#93C5FD" : "rgba(255,255,255,0.52)",
                        borderLeft: active ? "3px solid #3B82F6" : "3px solid transparent",
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div
              className="rounded-2xl p-4 mt-4"
              style={{
                background: CARD,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4 shrink-0" style={{ color: GOLD_MID }} />
                <span className="text-[12px] font-bold text-white uppercase tracking-wide">
                  Dúvidas frequentes
                </span>
              </div>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                Respostas sobre participação, pagamentos e privacidade.
              </p>
              <Link href="/indique" className="text-[11px] font-semibold text-sky-400 hover:text-sky-300">
                Central de ajuda →
              </Link>
            </div>
          </aside>

          <div className="min-w-0">
            {/* Mobile: cartão versão / LGPD */}
            <div
              className="lg:hidden rounded-2xl p-4 mb-4 flex items-center gap-3"
              style={{
                background: CARD,
                border: "1px solid rgba(212, 175, 55, 0.38)",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(212, 175, 55, 0.2)",
                  border: "1px solid rgba(212, 175, 55, 0.32)",
                }}
              >
                <FileText className="w-5 h-5" style={{ color: GOLD_MID }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-white leading-tight">
                  Versão 2.1 · 24 Mar 2026
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
                  Em conformidade com a LGPD
                </p>
              </div>
              <span
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: "rgba(34, 197, 94, 0.14)",
                  border: "1px solid rgba(34, 197, 94, 0.32)",
                  color: "#4ADE80",
                }}
              >
                <Check className="w-3 h-3" strokeWidth={3} />
                LGPD
              </span>
            </div>

            {/* Intro */}
            <div className="mb-5 lg:mb-8">
              <div
                className="lg:hidden rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <p className="text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.52)" }}>
                  Estes Termos de Uso regulam o acesso e a utilização da plataforma Bolão do Milhão. Leia com
                  atenção antes de participar dos bolões ou utilizar qualquer funcionalidade.
                </p>
              </div>
              <p className="hidden lg:block text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.52)" }}>
                Estes Termos de Uso regulam o acesso e a utilização da plataforma Bolão do Milhão. Leia com
                atenção antes de participar dos bolões ou utilizar qualquer funcionalidade.
              </p>
            </div>

            {/* Mobile: accordion */}
            <div className="lg:hidden flex flex-col gap-2.5 mb-8">
              {SECTIONS.map((section, i) => {
                const acc = SECTION_ACCENTS[i % SECTION_ACCENTS.length];
                const open = openMobile === i;
                return (
                  <div
                    key={section.title}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: CARD,
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenMobile(open ? null : i)}
                      className="w-full flex items-start gap-3 p-4 text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: acc.bg, border: `1px solid ${acc.border}` }}
                      >
                        <span className="text-[13px] font-black" style={{ color: acc.icon }}>
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[14px] font-bold text-white leading-snug pr-1">
                            {section.title}
                          </span>
                          <ChevronDown
                            className={`w-5 h-5 shrink-0 transition-transform mt-0.5 ${open ? "rotate-180" : ""}`}
                            style={{ color: "rgba(255,255,255,0.35)" }}
                          />
                        </div>
                        <p className="text-[12px] mt-1.5 leading-snug" style={{ color: "rgba(255,255,255,0.38)" }}>
                          {section.preview}
                        </p>
                      </div>
                    </button>
                    {open && (
                      <div
                        className="px-4 pb-4 pt-0 border-t border-white/6"
                      >
                        <ul className="list-disc pl-5 space-y-2 text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {section.body.map((p, pi) => (
                            <li key={pi}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop: cartões numerados */}
            <div className="hidden lg:flex flex-col gap-5">
              {SECTIONS.map((section, i) => {
                const acc = SECTION_ACCENTS[i % SECTION_ACCENTS.length];
                return (
                  <article
                    key={section.title}
                    className="rounded-2xl p-6"
                    style={{
                      background: CARD,
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: acc.bg, border: `1px solid ${acc.border}` }}
                      >
                        <span className="text-lg font-black" style={{ color: acc.icon }}>
                          {i + 1}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-white pt-1.5 leading-tight">
                        {section.title}
                      </h2>
                    </div>
                    <div className="space-y-3 text-[14px] leading-relaxed pl-0 lg:pl-[64px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                      {section.body.map((p, pi) => (
                        <p key={pi}>{p}</p>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop: rodapé CTA */}
            <div
              className="hidden lg:flex mt-10 rounded-2xl px-8 py-6 items-center justify-between gap-6"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                Ainda tem dúvidas sobre estes termos?
              </p>
              <Link
                href="/indique"
                className="shrink-0 px-6 py-3 rounded-xl text-[14px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#F97316" }}
              >
                Falar com suporte
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile: bloco concordância + botão */}
        <div
          className="lg:hidden fixed left-0 right-0 z-20 px-4 pt-4 pb-5"
          style={{
            bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
            background: `linear-gradient(180deg, transparent 0%, ${BG} 22%)`,
          }}
        >
          <div
            className="rounded-2xl p-4 mb-3"
            style={{
              background: CARD,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <p className="text-[15px] font-bold text-white mb-1">Você leu estes termos?</p>
            <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              Ao continuar usando o app, você confirma que leu e compreendeu estes Termos de Uso.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAgreed(true)}
            className="w-full flex items-center justify-center gap-2 min-h-[52px] rounded-xl text-[15px] font-black text-[#0E141B]"
            style={{
              background: "linear-gradient(90deg, #FFE8BA 0%, #F97316 100%)",
              boxShadow: "0 6px 28px rgba(249, 115, 22, 0.35)",
            }}
          >
            <Check className="w-5 h-5" strokeWidth={2.5} />
            {agreed ? "Obrigado!" : "Li e concordo"}
          </button>
        </div>
      </div>
    </div>
  );
}
