"use client";

import { useState } from "react";
import {
  Gift,
  Trophy,
  Diamond,
  Medal,
  MousePointerClick,
  UserPlus,
  Wallet,
  Zap,
  Link2,
  Check,
  ArrowRight,
  Copy,
  Ticket,
  ShieldCheck,
  ChevronRight,
  BarChart3,
} from "lucide-react";

/* ─── Design tokens ─── */
const C = {
  card: "#060B18",
  nested: "#0A0F1E",
  deep: "#020509",
  gold: "#BA901E",
  goldMid: "#FFE8BA",
  goldLight: "#FFE8BA",
  blue: "#5B8DEF",
  green: "#4CAF82",
  orange: "#FF8C42",
} as const;

/* ─── Dados ─── */
const TIERS: Array<{
  label: string; threshold: string; active: boolean; color: string; Icon: React.ElementType;
}> = [
    { label: "Bronze", threshold: "0+", active: false, color: "#CD7F32", Icon: Medal },
    { label: "Prata", threshold: "10+", active: false, color: "#A8A9AD", Icon: Medal },
    { label: "Ouro", threshold: "25+", active: true, color: C.gold, Icon: Trophy },
    { label: "Diamante", threshold: "50+", active: false, color: C.blue, Icon: Diamond },
  ];

const HOW_STEPS = [
  {
    Icon: Link2,
    color: C.blue,
    title: "Compartilhe seu link",
    desc: "Envie para amigos pelo WhatsApp, Instagram ou qualquer canal.",
  },
  {
    Icon: Ticket,
    color: C.orange,
    title: "Amigos compram o ticket",
    desc: "Cada ticket comprado com seu link conta como uma indicação válida.",
  },
  {
    Icon: Zap,
    color: C.green,
    title: "Você recebe na hora",
    desc: "R$8 creditados imediatamente após confirmação da compra.",
  },
];

const ATIVIDADES = [
  { initial: "C", name: "Carlos M.", color: C.gold, time: "há 2h atrás" },
  { initial: "A", name: "Ana Paula", color: C.blue, time: "há 5h atrás" },
  { initial: "R", name: "Ricardo S.", color: C.orange, time: "há 19h atrás" },
  { initial: "F", name: "Fernanda L.", color: C.green, time: "há 1d atrás" },
];

/* ─── Page ─── */
export default function IndiqueGanhePage() {
  const [amigos, setAmigos] = useState(10);
  const [copied, setCopied] = useState(false);

  const ganhoOuro = amigos * 12;
  const ganhoDiamante = amigos * 20;

  function handleCopy() {
    navigator.clipboard.writeText("https://bolao.com/ref/SEU_CODIGO").catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <div className="min-h-screen bg-[#03060D] pb-8">
      <style>{`
        @keyframes indiqueFade {
          from { opacity: 0.45; }
          to   { opacity: 1;    }
        }
      `}</style>
      <div className="max-w-[430px] mx-auto px-3.5 pt-3.5 space-y-3">

        {/* ══ HERO ══ */}
        <div
          className="rounded-[18px] p-5"
          style={{ background: C.card, border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="mb-4">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full"
              style={{ background: `${C.gold}1A`, border: `1px solid ${C.gold}45` }}
            >
              <Gift size={11} style={{ color: C.goldLight }} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: C.goldLight }}>
                Programa de Indicação
              </span>
            </span>
          </div>

          <h1 className="text-[26px] font-black text-white leading-[1.2] tracking-[-0.01em] mb-2.5">
            Indique amigos e<br />ganhe dinheiro
          </h1>
          <p className="text-[13px] leading-[1.6] mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>
            Cada amigo que comprar um ticket rende{" "}
            <span className="font-bold" style={{ color: C.goldMid }}>R$12,00</span> direto pra você.
          </p>

          <div className="flex gap-2.5 mb-4">
            <div
              className="flex-1 rounded-xl p-3"
              style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}30` }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#FFFFFF59" }}>
                Nível atual
              </p>
              <div className="flex items-center gap-1.5">
                <Trophy size={14} style={{ color: C.gold }} />
                <span className="text-[15px] font-black" style={{ color: C.gold }}>Ouro</span>
              </div>
            </div>
            <div
              className="flex-1 rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#FFFFFF59" }}>
                Por indicação
              </p>
              <p className="text-[18px] font-black text-white tracking-[-0.01em]">R$12,00</p>
            </div>
          </div>

          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-[10px]"
            style={{ background: `${C.blue}14`, border: `1px solid ${C.blue}25` }}
          >
            <Zap size={13} style={{ color: C.blue }} className="shrink-0" />
            <p className="text-[11px] leading-[1.55]" style={{ color: "rgba(255,255,255,0.45)" }}>
              Faltam <span className="font-bold text-white">16 indicações</span> para{" "}
              <span className="font-bold" style={{ color: C.blue }}>Diamante</span>{" "}—{" "}
              <span className="font-bold" style={{ color: C.goldMid }}>ganhe R$20/ind</span>
            </p>
          </div>
        </div>

        {/* ══ SEU PROGRESSO ══ */}
        <div>
          <SmallLabel className="mb-2.5">Seu Progresso</SmallLabel>
          <div className="grid grid-cols-3 gap-2">
            <StatCard Icon={MousePointerClick} iconColor="rgba(255,255,255,0.45)" value="215" label="Cliques" />
            <StatCard Icon={UserPlus} iconColor={C.orange} value="34+" label="Indicações" valueColor={C.orange} />
            <StatCard Icon={Wallet} iconColor={C.green} value="R$212" label="Ganhos" valueColor={C.green} highlight />
          </div>
        </div>

        {/* ══ JORNADA DE NÍVEIS ══ */}
        <div
          className="rounded-2xl px-4 pt-[18px] pb-5"
          style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <SmallLabel className="mb-7">Jornada de Níveis</SmallLabel>

          <div className="relative flex justify-between items-start mb-6 px-1">
            <div className="absolute top-5 left-5 right-5 h-[2px] rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div
              className="absolute top-5 left-5 h-[2px] rounded-full"
              style={{
                width: "calc(66.67% - 10px)",
                background: `linear-gradient(90deg, ${C.gold}, ${C.goldMid})`,
                boxShadow: `0 0 8px ${C.goldMid}90`,
              }}
            />
            {TIERS.map((tier) => {
              const Icon = tier.Icon;
              return (
                <div key={tier.label} className="flex flex-col items-center gap-1.5 z-10">
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={
                      tier.active
                        ? { width: 44, height: 44, background: "#1A1200", outline: `2.5px solid ${C.gold}`, outlineOffset: 3, boxShadow: `0 0 18px ${C.goldMid}80` }
                        : { width: 40, height: 40, background: "#0D1425", border: "1px solid rgba(255,255,255,0.08)" }
                    }
                  >
                    <Icon size={tier.active ? 21 : 17} style={{ color: tier.color }} />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: tier.active ? "#fff" : "rgba(255,255,255,0.30)" }}>
                    {tier.label}
                  </span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.20)" }}>{tier.threshold}</span>
                </div>
              );
            })}
          </div>

          <div
            className="flex items-center justify-between rounded-[14px] p-4 mb-5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: "rgba(255,255,255,0.30)" }}>Agora</p>
              <p className="text-[36px] font-black leading-none tracking-[-0.02em]" style={{ color: C.goldLight }}>R$12</p>
              <p className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.28)" }}>por indic.</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <ArrowRight size={15} style={{ color: "rgba(255,255,255,0.18)" }} />
              <span className="text-[13px] font-extrabold px-3 py-1.5 rounded-[8px]" style={{ background: "#22C55E18", border: "1px solid #22C55E30", color: "#22C55E" }}>
                +R$8
              </span>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: "rgba(255,255,255,0.30)" }}>No Diamante</p>
              <p className="text-[36px] font-black leading-none tracking-[-0.02em]" style={{ background: "linear-gradient(135deg, #7EC8FF, #5B8DEF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                R$20
              </p>
              <p className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.28)" }}>por indic.</p>
            </div>
          </div>

          <div className="h-[6px] rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="h-full w-[68%] rounded-full" style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.goldMid} 60%, ${C.blue})` }} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.38)" }}>
              <span className="font-bold text-white">34</span> de 50 indicações
            </p>
            <div className="flex items-center gap-1">
              <Diamond size={10} style={{ color: C.blue }} />
              <span className="text-[12px] font-bold" style={{ color: C.blue }}>+16 para Diamante</span>
            </div>
          </div>
        </div>

        {/* ══ SIMULE SEUS GANHOS ══ */}
        <div
          className="rounded-2xl"
          style={{
            background: C.card,
          }}
        >
          {/* Título */}
          <div className="px-4 pt-4 pb-4">
            <SectionHeader>Simule seus Ganhos</SectionHeader>
          </div>
          <div className="px-5 pb-5">
            <p className="text-[12px] mb-5" style={{ color: "rgba(255,255,255,0.36)" }}>
              Quantos amigos você consegue indicar?
            </p>

            {/* Slider com − e + */}
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => setAmigos((v) => Math.max(1, v - 1))}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px] font-bold shrink-0 select-none active:scale-95"
                style={{
                  background: "#00000038",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.55)",
                  transition: "transform 0.1s ease",
                }}
              >−</button>

              <input
                type="range" min={1} max={50} value={amigos}
                onChange={(e) => setAmigos(Number(e.target.value))}
                className="flex-1 accent-[#FAD98B] cursor-pointer"
                style={{ height: 4 }}
              />

              <button
                onClick={() => setAmigos((v) => Math.min(50, v + 1))}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px] font-bold shrink-0 select-none active:scale-95"
                style={{
                  background: "#00000038",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.55)",
                  transition: "transform 0.1s ease",
                }}
              >+</button>
            </div>

            {/* Contador */}
            <div className="text-center mb-5">
              <span
                key={amigos}
                className="text-[40px] font-black text-white tracking-[-0.02em] leading-none"
                style={{ animation: "indiqueFade 0.2s ease forwards" }}
              >
                {amigos}
              </span>
              <span className="text-[13px] font-medium ml-2" style={{ color: "rgba(255,255,255,0.38)" }}>
                amigos
              </span>
            </div>

            {/* Inner box de resultado — igual à imagem */}
            <div
              className="rounded-[14px] px-5 pt-5 pb-4 mb-4 text-center"
              style={{
                background: "linear-gradient(135deg, #FFD70012 0%, #F973160D 100%)",
                border: "1px solid #FFE8BA33",
              }}
            >
              <p className="text-[14px] mb-3" style={{ color: "#FFFFFF59" }}>
                No nível{" "}
                <span className="font-bold" style={{ color: C.goldMid }}>Ouro</span>
                {" "}você ganharia
              </p>

              {/* Valor em destaque */}
              <span
                key={ganhoOuro}
                className="text-[72px] font-black leading-none tracking-[-0.03em] block mb-4"
                style={{
                  animation: "indiqueFade 0.2s ease forwards",
                  background: `linear-gradient(180deg, #FFF9F3 0%, ${C.goldLight} 28%, ${C.goldMid} 62%, #FEC554 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                R${ganhoOuro}
              </span>

              {/* Hint Diamante */}
              <div className="flex items-center justify-center gap-1.5 bg-[#FAD98B14] py-3 border-2 border-[#FAD98B33] rounded-[10px]">
                <Diamond size={11} style={{ color: "#FAD98B" }} />
                <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                  No Diamante:{" "}
                  <span
                    key={ganhoDiamante}
                    className="font-bold"
                    style={{
                      color: "#FAD98B",
                      animation: "indiqueFade 0.2s ease forwards",
                    }}
                  >
                    R${ganhoDiamante}
                  </span>
                </p>
              </div>
            </div>

            {/* Botão */}
            <button
              onClick={handleCopy}
              className="w-full h-[52px] rounded-[10px] text-[14px] font-black tracking-[0.06em] uppercase flex items-center justify-center gap-2 active:scale-[0.98]"
              style={{
                transition: "transform 0.1s ease, box-shadow 0.3s ease, background 0.3s ease",
                border: "none",
                ...(copied
                  ? { background: "linear-gradient(135deg, #2E7D52, #43A874)", color: "#fff", boxShadow: "0 0 20px rgba(67,168,116,0.25)" }
                  : { background: `linear-gradient(135deg, #E89520, ${C.goldMid} 50%, #FFD96A)`, color: "#0E141B", boxShadow: `0 0 24px ${C.goldMid}40, 0 4px 14px rgba(0,0,0,0.5)` }
                ),
              }}
            >
              {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} strokeWidth={2.5} />}
              {copied ? "Link Copiado!" : "Copiar Link Agora"}
            </button>
          </div>

        </div>

        {/* ══ COMO FUNCIONA ══ */}
        <div
          className="rounded-2xl p-5"
          style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <SectionHeader>Como Funciona</SectionHeader>

          <div className="flex flex-col gap-2.5 mt-4">
            {HOW_STEPS.map((step, i) => {
              const Icon = step.Icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3.5 rounded-[14px] p-4"
                  style={{ background: C.nested, border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {/* Ícone */}
                  <div
                    className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center shrink-0"
                    style={{ background: `${step.color}18`, border: `1px solid ${step.color}28` }}
                  >
                    <Icon size={20} style={{ color: step.color }} />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Step number badge */}
                      <span
                        className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                        style={{ background: `${step.color}25`, color: step.color }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-[13px] font-extrabold text-white leading-none">{step.title}</p>
                    </div>
                    <p className="text-[11px] leading-[1.55]" style={{ color: "rgba(255,255,255,0.38)" }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══ ATIVIDADE RECENTE ══ */}
        <div
          className="rounded-2xl p-5"
          style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <SectionHeader>Atividade Recente</SectionHeader>

          <div className="flex flex-col gap-0 mt-4">
            {ATIVIDADES.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3"
                style={i < ATIVIDADES.length - 1 ? { borderBottom: "1px solid rgba(255,255,255,0.05)" } : {}}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-[15px] font-black shrink-0"
                    style={{ background: `${item.color}1A`, border: `1.5px solid ${item.color}45`, color: item.color }}
                  >
                    {item.initial}
                  </div>

                  {/* Info */}
                  <div>
                    <p className="text-[13px] leading-none mb-1">
                      <span className="font-bold text-white">{item.name}</span>
                      <span style={{ color: "rgba(255,255,255,0.45)" }}> comprou um ticket</span>
                    </p>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>{item.time}</p>
                  </div>
                </div>

                {/* Badge ganho */}
                <span
                  className="text-[12px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
                  style={{ color: C.green, background: `${C.green}18`, border: `1px solid ${C.green}28` }}
                >
                  +R$8
                </span>
              </div>
            ))}
          </div>

          {/* Ver histórico */}
          <button
            className="w-full flex items-center justify-center gap-1 mt-3 pt-3 text-[12px] font-semibold transition-opacity hover:opacity-70"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.38)" }}
          >
            Ver todo histórico
            <ChevronRight size={13} />
          </button>
        </div>

        {/* ══ TRUST BAR ══ */}
        <div
          className="rounded-2xl"
          style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center">
            <TrustItem Icon={ShieldCheck} label="Pagamento seguro" />
            <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.06)" }} />
            <TrustItem Icon={Check} label="Confirmação imediata" />
            <div className="w-px self-stretch" style={{ background: "rgba(255,255,255,0.06)" }} />
            <TrustItem Icon={BarChart3} label="Ranking transparente" />
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── Componentes ─────────────────────────────────────────── */

function SmallLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${className}`} style={{ color: "rgba(255,255,255,0.28)" }}>
      {children}
    </p>
  );
}

/** Cabeçalho de seção com barra azul lateral — padrão visual da imagem */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[3px] h-[18px] rounded-full" style={{ background: C.gold }} />
      <span className="text-[15px] font-bold text-white">{children}</span>
    </div>
  );
}

function StatCard({
  Icon, iconColor, value, valueColor = "#fff", label, highlight = false,
}: {
  Icon: React.ElementType; iconColor: string;
  value: string; valueColor?: string;
  label: string; highlight?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-center gap-2.5"
      style={{
        background: highlight ? "#071410" : C.nested,
        border: highlight ? "1px solid rgba(76,175,130,0.15)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        className="w-[42px] h-[42px] rounded-xl flex items-center justify-center"
        style={{ background: `${iconColor}20`, border: `1px solid ${iconColor}30` }}
      >
        <Icon size={19} style={{ color: iconColor }} />
      </div>
      <span className="text-[22px] font-black leading-none" style={{ color: valueColor }}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.32)" }}>
        {label}
      </span>
    </div>
  );
}

function TrustItem({ Icon, label }: { Icon: React.ElementType; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1.5 py-4">
      <Icon size={16} style={{ color: "rgba(255,255,255,0.35)" }} />
      <span className="text-[10px] font-medium text-center leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>
        {label}
      </span>
    </div>
  );
}
