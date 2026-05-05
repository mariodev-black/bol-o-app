"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Check,
  Database,
  Eye,
  FileText,
  Lock,
  Mail,
  RefreshCw,
  Share2,
  Shield,
  ShieldCheck,
  Cookie,
  Archive,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const BG = "#020617";
const CARD = "#0f172a";
const CARD_HEADER = "#0c1322";
const GOLD = "#B1EB0B";
const GOLD_MID = "#E8FF8A";
const TEXT_MUTED = "#94a3b8";
const TEXT_INDEX_INACTIVE = "#9CA3AF";
const BRAND_GOLD = "#B1EB0B";
const BRAND_GOLD_LIGHT = "#E8FF8A";

/** Metadados do cabeçalho (alinhados ao layout de referência). */
const HEADER_META =
  "Última atualização: 23 de março de 2026 | Bolão do Milhão Ltda.* | CNPJ: 00.000.000/0001-00";

type Accent = { bg: string; border: string; bullet: string; icon: string };

const ACCENTS: Accent[] = [
  { bg: "rgba(177, 235, 11, 0.16)", border: "rgba(177, 235, 11, 0.34)", bullet: "#B1EB0B", icon: "#E8FF8A" },
  { bg: "rgba(217, 255, 89, 0.12)", border: "rgba(217, 255, 89, 0.28)", bullet: "#E8FF8A", icon: "#E8FF8A" },
  { bg: "rgba(177, 235, 11, 0.13)", border: "rgba(177, 235, 11, 0.3)", bullet: "#B1EB0B", icon: "#E8FF8A" },
  { bg: "rgba(217, 255, 89, 0.1)", border: "rgba(217, 255, 89, 0.24)", bullet: "#E8FF8A", icon: "#E8FF8A" },
  { bg: "rgba(177, 235, 11, 0.11)", border: "rgba(177, 235, 11, 0.26)", bullet: "#B1EB0B", icon: "#E8FF8A" },
  { bg: "rgba(217, 255, 89, 0.15)", border: "rgba(217, 255, 89, 0.32)", bullet: "#E8FF8A", icon: "#E8FF8A" },
  { bg: "rgba(177, 235, 11, 0.14)", border: "rgba(177, 235, 11, 0.3)", bullet: "#B1EB0B", icon: "#E8FF8A" },
  { bg: "rgba(217, 255, 89, 0.13)", border: "rgba(217, 255, 89, 0.3)", bullet: "#E8FF8A", icon: "#E8FF8A" },
  { bg: "rgba(177, 235, 11, 0.12)", border: "rgba(177, 235, 11, 0.28)", bullet: "#B1EB0B", icon: "#E8FF8A" },
];

const INDEX_ITEMS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "sec-1", label: "Informações que Coletamos", Icon: Database },
  { id: "sec-2", label: "Como Usamos suas Informações", Icon: Eye },
  { id: "sec-3", label: "Compartilhamento de Dados", Icon: Share2 },
  { id: "sec-4", label: "Segurança das Informações", Icon: Lock },
  { id: "sec-5", label: "Seus Direitos (LGPD)", Icon: Shield },
  { id: "sec-6", label: "Cookies e Tecnologias de Rastreamento", Icon: Cookie },
  { id: "sec-7", label: "Retenção de Dados", Icon: Archive },
  { id: "sec-8", label: "Alterações nesta Política", Icon: RefreshCw },
  { id: "sec-9", label: "Como nos Contatar", Icon: Mail },
];

const INTRO =
  "A sua privacidade é importante para nós. Esta Política de Privacidade explica como o Bolão do Milhão coleta, usa, armazena e compartilha suas informações pessoais quando você utiliza nossa plataforma de bolões esportivos. Ao usar nossos serviços, você concorda com as práticas descritas neste documento.";

type Bullet = { bold?: string; text: string };

type SectionBlock =
  | { type: "p"; text: string; strong?: string }
  | { type: "ul"; items: Bullet[] }
  | { type: "p-plain"; text: string };

interface PrivacySectionData {
  id: string;
  num: number;
  title: string;
  preview: string;
  Icon: LucideIcon;
  blocks: SectionBlock[];
}

const SECTIONS_DATA: PrivacySectionData[] = [
  {
    id: "sec-1",
    num: 1,
    title: "Informações que Coletamos",
    preview: "Categorias de dados coletados no cadastro e no uso da plataforma.",
    Icon: Database,
    blocks: [
      {
        type: "p",
        text: "Ao utilizar o Bolão do Milhão, coletamos as seguintes categorias de informações:",
      },
      {
        type: "ul",
        items: [
          { bold: "Dados de cadastro:", text: " nome completo, endereço de e-mail, número de telefone e data de nascimento." },
          { bold: "Dados de uso:", text: " palpites realizados, histórico de partidas, posição no ranking e estatísticas de desempenho." },
          {
            bold: "Dados financeiros:",
            text: " informações necessárias para processamento de pagamentos e recebimentos do programa de indicação (não armazenamos dados completos de cartão).",
          },
          {
            bold: "Dados técnicos:",
            text: " endereço IP, tipo de dispositivo, sistema operacional, identificadores de cookies e logs de acesso.",
          },
          {
            bold: "Dados de indicação:",
            text: " links gerados, número de cliques, conversões e identificação dos usuários indicados.",
          },
        ],
      },
      {
        type: "p-plain",
        text: "Todas as informações são coletadas diretamente de você no momento do cadastro ou automaticamente durante o uso da plataforma.",
      },
    ],
  },
  {
    id: "sec-2",
    num: 2,
    title: "Como Usamos suas Informações",
    preview: "Finalidades do tratamento dos seus dados pessoais.",
    Icon: Eye,
    blocks: [
      { type: "p", text: "Utilizamos seus dados pessoais para as seguintes finalidades:" },
      {
        type: "ul",
        items: [
          { text: "Criação e gestão da sua conta de usuário." },
          { text: "Processamento e registro de palpites nas rodadas do bolão." },
          { text: "Cálculo de pontuação, ranking e premiações." },
          { text: "Processamento de pagamentos e créditos do programa de indicação." },
          { text: "Envio de notificações sobre resultados, novas rodadas e atualizações do serviço." },
          { text: "Prevenção de fraudes e garantia da integridade das competições." },
          { text: "Melhoria contínua da plataforma com base em análise de uso." },
          { text: "Cumprimento de obrigações legais e regulatórias." },
        ],
      },
    ],
  },
  {
    id: "sec-3",
    num: 3,
    title: "Compartilhamento de Dados",
    preview: "Quando e com quem seus dados podem ser compartilhados.",
    Icon: Share2,
    blocks: [
      { type: "p", text: "Não vendemos seus dados pessoais. Podemos compartilhá-los apenas nas seguintes situações:" },
      {
        type: "ul",
        items: [
          {
            bold: "Prestadores de serviços:",
            text: " empresas que auxiliam na operação da plataforma (processadores de pagamento, provedores de hospedagem, serviços de e-mail) sob rigorosos contratos de confidencialidade.",
          },
          { bold: "Cumprimento legal:", text: " quando exigido por lei, ordem judicial ou autoridade competente." },
          {
            bold: "Proteção de direitos:",
            text: " para proteger os direitos, propriedade ou segurança do Bolão do Milhão, seus usuários ou terceiros.",
          },
          {
            bold: "Transações corporativas:",
            text: " em caso de fusão, aquisição ou venda de ativos, seus dados podem ser transferidos como parte da transação.",
          },
        ],
      },
      {
        type: "p-plain",
        text: "Dados de ranking e palpites podem ser exibidos publicamente na plataforma com seu nome de usuário, conforme as configurações de privacidade da sua conta.",
      },
    ],
  },
  {
    id: "sec-4",
    num: 4,
    title: "Segurança das Informações",
    preview: "Medidas técnicas e organizacionais para proteger seus dados.",
    Icon: Lock,
    blocks: [
      {
        type: "p",
        text: "Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda, destruição ou alteração:",
      },
      {
        type: "ul",
        items: [
          { text: "Criptografia SSL/TLS em todas as transmissões de dados." },
          { text: "Armazenamento de senhas com hash criptográfico (bcrypt)." },
          { text: "Controle de acesso restrito aos dados pessoais internamente." },
          { text: "Monitoramento contínuo de ameaças e vulnerabilidades." },
          { text: "Backups regulares e redundância de infraestrutura." },
        ],
      },
      {
        type: "p-plain",
        text: "Apesar de nossos esforços, nenhum sistema é 100% seguro. Recomendamos que você use senhas fortes e únicas e ative a autenticação em dois fatores quando disponível.",
      },
    ],
  },
  {
    id: "sec-5",
    num: 5,
    title: "Seus Direitos (LGPD)",
    preview: "Direitos previstos na Lei nº 13.709/2018 e como exercê-los.",
    Icon: Shield,
    blocks: [
      {
        type: "p",
        text: "Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você possui os seguintes direitos:",
      },
      {
        type: "ul",
        items: [
          { text: "Confirmação e acesso: saber se tratamos seus dados e solicitar uma cópia." },
          { text: "Correção: solicitar a atualização de dados incompletos, inexatos ou desatualizados." },
          {
            text: "Anonimização, bloqueio ou eliminação: dos dados desnecessários ou tratados em desconformidade com a LGPD.",
          },
          { text: "Portabilidade: receber seus dados em formato estruturado e interoperável." },
          { text: "Eliminação: solicitar a exclusão dos dados tratados com base no seu consentimento." },
          { text: "Revogação do consentimento: retirar o consentimento dado anteriormente, a qualquer momento." },
          { text: "Oposição: se opor ao tratamento realizado com base em outras hipóteses legais." },
        ],
      },
      {
        type: "p-plain",
        text: "Para exercer seus direitos, entre em contato conosco pelo e-mail privacidade@bolaodomilhao.com.br. Responderemos em até 15 dias úteis.",
      },
    ],
  },
  {
    id: "sec-6",
    num: 6,
    title: "Cookies e Tecnologias de Rastreamento",
    preview: "Uso de cookies e tecnologias similares na plataforma.",
    Icon: Cookie,
    blocks: [
      {
        type: "p",
        text: "Utilizamos cookies e tecnologias de rastreamento para manter sua sessão, lembrar preferências, medir audiência e melhorar a experiência. Você pode gerenciar cookies nas configurações do navegador; algumas funções podem deixar de estar disponíveis se cookies essenciais forem desativados.",
      },
    ],
  },
  {
    id: "sec-7",
    num: 7,
    title: "Retenção de Dados",
    preview: "Por quanto tempo mantemos suas informações.",
    Icon: Archive,
    blocks: [
      {
        type: "p",
        text: "Mantemos seus dados pelo tempo necessário para as finalidades descritas nesta política ou conforme exigido por lei:",
      },
      {
        type: "ul",
        items: [
          { text: "Dados de conta ativa: durante toda a vigência da sua conta." },
          { text: "Dados após encerramento: até 5 anos, conforme exigências fiscais e legais." },
          { text: "Dados de logs de acesso: conforme o Marco Civil da Internet (6 meses mínimo)." },
          { text: "Dados financeiros: 5 anos após a última transação." },
        ],
      },
      {
        type: "p-plain",
        text: "Após o prazo de retenção, seus dados são anonimizados ou eliminados de forma segura.",
      },
    ],
  },
  {
    id: "sec-8",
    num: 8,
    title: "Alterações nesta Política",
    preview: "Como comunicamos atualizações desta política.",
    Icon: RefreshCw,
    blocks: [
      {
        type: "p",
        text: "Esta Política de Privacidade pode ser atualizada periodicamente. Notificaremos você sobre mudanças significativas por:",
      },
      {
        type: "ul",
        items: [
          { text: "Notificação por e-mail para o endereço cadastrado." },
          { text: "Aviso em destaque na plataforma na data da atualização." },
          { text: "Publicação da nova versão nesta página com a data de vigência atualizada." },
        ],
      },
      {
        type: "p-plain",
        text: "O uso continuado da plataforma após as alterações constitui aceitação da nova política. Recomendamos revisar esta página periodicamente.",
      },
    ],
  },
  {
    id: "sec-9",
    num: 9,
    title: "Como nos Contatar",
    preview: "Canais para o encarregado de dados e dúvidas sobre privacidade.",
    Icon: Mail,
    blocks: [
      {
        type: "p",
        text: "Para questões relacionadas à privacidade e proteção de dados, entre em contato com nosso Encarregado de Proteção de Dados (DPO):",
      },
      {
        type: "ul",
        items: [
          { bold: "E-mail:", text: " privacidade@bolaodomilhao.com.br" },
          { bold: "Prazo de resposta:", text: " até 15 dias úteis." },
          {
            bold: "Para solicitações urgentes ou reclamações:",
            text: " ouvidoria@bolaodomilhao.com.br",
          },
          { bold: "Autoridade Nacional de Proteção de Dados (ANPD):", text: " www.gov.br/anpd" },
        ],
      },
    ],
  },
];

function SectionBody({
  blocks,
  accent,
}: {
  blocks: SectionBlock[];
  accent: Accent;
}) {
  return (
    <div className="space-y-4 text-[14px] leading-relaxed" style={{ color: TEXT_MUTED }}>
      {blocks.map((block, i) => {
        if (block.type === "p") {
          return (
            <p key={i}>
              {block.text}
              {block.strong && <strong className="text-white font-semibold">{block.strong}</strong>}
            </p>
          );
        }
        if (block.type === "p-plain") {
          return <p key={i}>{block.text}</p>;
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="space-y-2.5 pl-0 list-none">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 mt-2"
                    style={{ backgroundColor: accent.bullet }}
                  />
                  <span>
                    {item.bold && <strong className="text-white font-semibold">{item.bold}</strong>}
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function PrivacidadePage() {
  const [activeId, setActiveId] = useState("sec-1");
  const [openMobile, setOpenMobile] = useState<number | null>(0);
  const [agreed, setAgreed] = useState(false);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }, []);

  useEffect(() => {
    const ACTIVATE_BELOW = 160;

    const syncActiveFromScroll = () => {
      let current = INDEX_ITEMS[0]?.id ?? "sec-1";
      for (const item of INDEX_ITEMS) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= ACTIVATE_BELOW) current = item.id;
      }
      setActiveId(current);
    };

    syncActiveFromScroll();
    window.addEventListener("scroll", syncActiveFromScroll, { passive: true });
    window.addEventListener("resize", syncActiveFromScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", syncActiveFromScroll);
      window.removeEventListener("resize", syncActiveFromScroll);
    };
  }, []);

  return (
    <div className="min-h-screen pb-32 lg:pb-16">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div
          className="absolute -top-1/4 -right-1/4 w-[72%] h-[58%]"
          style={{
            background:
              "radial-gradient(ellipse 75% 65% at 78% 18%, rgba(217, 255, 89, 0.1) 0%, transparent 68%)",
          }}
        />
        <div
          className="absolute -bottom-1/4 -left-1/4 w-[68%] h-[52%]"
          style={{
            background:
              "radial-gradient(ellipse 70% 58% at 18% 82%, rgba(249, 115, 22, 0.09) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-6 lg:pt-10 lg:px-8">
        {/* Mobile header */}
        <div className="lg:hidden text-center mb-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] mb-2" style={{ color: GOLD_MID }}>
            Bolão do Milhão
          </p>
          <h1 className="text-[26px] font-black text-white tracking-tight leading-tight">Política de Privacidade</h1>
        </div>

        {/* Desktop header — ícone + título + badge na mesma linha; meta abaixo alinhada ao texto */}
        <header className="hidden lg:block mb-10">
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "rgba(177, 235, 11, 0.08)",
                border: `1px solid rgba(177, 235, 11, 0.45)`,
              }}
            >
              <FileText className="w-6 h-6" style={{ color: GOLD }} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-3 gap-y-1">
                <h1 className="text-[30px] xl:text-[32px] font-black text-white tracking-tight leading-tight">
                  Política de Privacidade
                </h1>
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold text-white shrink-0 leading-none"
                  style={{
                    background: `linear-gradient(180deg, ${BRAND_GOLD_LIGHT} 0%, ${BRAND_GOLD} 100%)`,
                    color: "#0E141B",
                  }}
                >
                  v2.1
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-snug" style={{ color: TEXT_INDEX_INACTIVE }}>
                {HEADER_META}
              </p>
            </div>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-[minmax(280px,32%)_1fr] lg:gap-8 xl:gap-10 lg:items-start">
          {/* Sidebar */}
          <aside className="hidden lg:flex flex-col gap-5">
            <div
              className="rounded-2xl p-4"
              style={{ background: CARD, border: "1px solid rgba(148, 163, 184, 0.12)" }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3.5"
                style={{ color: TEXT_INDEX_INACTIVE }}
              >
                ÍNDICE
              </p>
              <nav className="flex flex-col gap-1" aria-label="Seções da política">
                {INDEX_ITEMS.map((item) => {
                  const active = activeId === item.id;
                  const Icon = item.Icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollTo(item.id)}
                      className="group flex items-start gap-3 w-full text-left rounded-lg py-2.5 pl-2.5 pr-2 transition-colors relative"
                      style={{
                        background: active ? "rgba(177, 235, 11, 0.16)" : "transparent",
                        borderLeft: active ? "3px solid #B1EB0B" : "3px solid transparent",
                        color: active ? "#ffffff" : TEXT_INDEX_INACTIVE,
                      }}
                    >
                      <Icon
                        className="w-4 h-4 shrink-0 mt-0.5"
                        style={{ color: active ? "#E8FF8A" : "rgba(148, 163, 184, 0.55)" }}
                        strokeWidth={2}
                      />
                      <span
                        className={`text-[12px] leading-snug pr-1 ${active ? "font-bold text-white" : "font-semibold"}`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div
              className="rounded-2xl p-4"
              style={{
                background: CARD,
                border: "1px solid rgba(148, 163, 184, 0.12)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: BRAND_GOLD_LIGHT }} strokeWidth={2} />
                <span className="text-[13px] font-bold" style={{ color: BRAND_GOLD_LIGHT }}>
                  Conformidade LGPD
                </span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: TEXT_INDEX_INACTIVE }}>
                Esta política está em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados).
              </p>
            </div>
          </aside>

          <div className="min-w-0 lg:scroll-mt-24">
            {/* Mobile versão */}
            <div
              className="lg:hidden rounded-2xl p-4 mb-4 flex items-center gap-3"
              style={{
                background: CARD,
                border: `1px solid rgba(177, 235, 11, 0.35)`,
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(177, 235, 11, 0.15)",
                  border: "1px solid rgba(177, 235, 11, 0.3)",
                }}
              >
                <FileText className="w-5 h-5" style={{ color: GOLD_MID }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-white leading-tight">Versão 2.1 · 23 Mar 2026</p>
                <p className="text-[12px] mt-0.5" style={{ color: TEXT_MUTED }}>
                  Em conformidade com a LGPD
                </p>
              </div>
              <span
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
                style={{
                  background: "rgba(177, 235, 11, 0.15)",
                  border: "1px solid rgba(177, 235, 11, 0.35)",
                  color: BRAND_GOLD_LIGHT,
                }}
              >
                <Check className="w-3 h-3" strokeWidth={3} />
                LGPD
              </span>
            </div>

            {/* Intro card */}
            <div
              className="rounded-2xl p-5 mb-6 lg:mb-8"
              style={{ background: CARD, border: "1px solid rgba(148, 163, 184, 0.12)" }}
            >
              <p className="text-[14px] lg:text-[15px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                A sua privacidade é importante para nós. Esta Política de Privacidade explica como o{" "}
                <strong className="text-white font-semibold">Bolão do Milhão</strong> coleta, usa, armazena e
                compartilha suas informações pessoais quando você utiliza nossa plataforma de bolões esportivos. Ao usar
                nossos serviços, você concorda com as práticas descritas neste documento.
              </p>
            </div>

            {/* Mobile accordion */}
            <div className="lg:hidden flex flex-col gap-2.5 mb-8">
              {SECTIONS_DATA.map((sec, i) => {
                const accent = ACCENTS[i % ACCENTS.length];
                const open = openMobile === i;
                const Icon = sec.Icon;
                return (
                  <div
                    key={sec.id}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: CARD, border: "1px solid rgba(148, 163, 184, 0.1)" }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenMobile(open ? null : i)}
                      className="w-full flex items-start gap-3 p-4 text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: accent.icon }} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[14px] font-bold text-white leading-snug">
                            {sec.num}. {sec.title}
                          </span>
                          <ChevronDown
                            className={`w-5 h-5 shrink-0 transition-transform mt-0.5 ${open ? "rotate-180" : ""}`}
                            style={{ color: "rgba(148, 163, 184, 0.5)" }}
                          />
                        </div>
                        <p className="text-[12px] mt-1.5 leading-snug" style={{ color: TEXT_MUTED }}>
                          {sec.preview}
                        </p>
                      </div>
                    </button>
                    {open && (
                      <div className="px-4 pb-5 pt-0 border-t border-white/10">
                        <div className="pt-4">
                          <SectionBody blocks={sec.blocks} accent={accent} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop sections */}
            <div className="hidden lg:flex flex-col gap-6">
              {SECTIONS_DATA.map((sec, i) => {
                const accent = ACCENTS[i % ACCENTS.length];
                const Icon = sec.Icon;
                return (
                  <article
                    id={sec.id}
                    key={sec.id}
                    className="rounded-2xl overflow-hidden scroll-mt-28"
                    style={{ background: CARD, border: "1px solid rgba(148, 163, 184, 0.12)" }}
                  >
                    <div
                      className="flex items-center gap-4 px-6 py-4 border-b border-white/5"
                      style={{ background: CARD_HEADER }}
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: accent.bg, border: `1px solid ${accent.border}` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: accent.icon }} strokeWidth={2} />
                      </div>
                      <h2 className="text-lg font-bold text-white">
                        {sec.num}. {sec.title}
                      </h2>
                    </div>
                    <div className="px-6 py-5">
                      <SectionBody blocks={sec.blocks} accent={accent} />
                    </div>
                  </article>
                );
              })}
            </div>

            <div
              className="hidden lg:flex mt-10 rounded-2xl px-8 py-6 items-center justify-between gap-6"
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(148, 163, 184, 0.12)",
              }}
            >
              <p className="text-[14px]" style={{ color: TEXT_MUTED }}>
                Ainda tem dúvidas?
              </p>
              <Link
                href="mailto:privacidade@bolaodomilhao.com.br"
                className="shrink-0 px-6 py-3 rounded-xl text-[14px] font-bold text-white transition-opacity hover:opacity-90"
                style={{
                  background: `linear-gradient(180deg, ${BRAND_GOLD_LIGHT} 0%, ${BRAND_GOLD} 100%)`,
                  color: "#0E141B",
                }}
              >
                Falar com Suporte
              </Link>
            </div>
          </div>
        </div>

        <div
          className="lg:hidden fixed left-0 right-0 z-20 px-4 pt-4 pb-5"
          style={{
            bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
            background: `linear-gradient(180deg, transparent 0%, ${BG} 22%)`,
          }}
        >
          <div
            className="rounded-2xl p-4 mb-3"
            style={{ background: CARD, border: "1px solid rgba(148, 163, 184, 0.1)" }}
          >
            <p className="text-[15px] font-bold text-white mb-1">Você leu esta política?</p>
            <p className="text-[12px] leading-relaxed" style={{ color: TEXT_MUTED }}>
              Ao continuar usando o app, você confirma que leu e compreendeu esta Política de Privacidade.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAgreed(true)}
            className="w-full flex items-center justify-center gap-2 min-h-[52px] rounded-xl text-[15px] font-black text-[#0E141B]"
            style={{
              background: `linear-gradient(90deg, ${BRAND_GOLD_LIGHT} 0%, ${BRAND_GOLD} 100%)`,
              boxShadow: "0 6px 28px rgba(177, 235, 11, 0.35)",
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
