"use client";

import { useState } from "react";
import {
  Gift,
  Trophy,
  Gem,
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
  Share2,
} from "lucide-react";

/* ─── Design tokens ─── */
const C = {
  card: "#0A0E19",
  nested: "rgba(255,255,255,0.04)",
  deep: "#020509",
  gold: "#D4AF37",
  goldMid: "#FFE8BA",
  goldLight: "#FFE8BA",
  /** Platina / “Diamante” sem azul — identidade dourada + neutro premium */
  platinum: "#C5D0E0",
  platinumMuted: "rgba(197,208,224,0.55)",
  /** Verde só para ganhos / crédito (como em palpites: #22C55E) */
  gain: "#22C55E",
  gainSoft: "rgba(34,197,94,0.12)",
} as const;

/* ─── Dados ─── */
const TIERS: Array<{
  label: string; threshold: string; active: boolean; color: string; Icon: React.ElementType;
}> = [
    { label: "Bronze", threshold: "0+", active: false, color: "#CD7F32", Icon: Medal },
    { label: "Prata", threshold: "10+", active: false, color: "#A8A9AD", Icon: Medal },
    { label: "Ouro", threshold: "25+", active: true, color: C.gold, Icon: Trophy },
    { label: "Diamante", threshold: "50+", active: false, color: C.platinum, Icon: Gem },
  ];

const HOW_STEPS = [
  {
    Icon: Link2,
    color: C.gold,
    title: "Compartilhe seu link",
    desc: "Envie para amigos pelo WhatsApp, Instagram ou qualquer canal.",
  },
  {
    Icon: Ticket,
    color: C.goldMid,
    title: "Amigos compram o ticket",
    desc: "Cada ticket comprado com seu link conta como uma indicação válida.",
  },
  {
    Icon: Zap,
    color: C.gain,
    title: "Você recebe na hora",
    desc: "R$8 creditados imediatamente após confirmação da compra.",
  },
];

const ATIVIDADES = [
  { initial: "C", name: "Carlos M.", time: "há 2h atrás" },
  { initial: "A", name: "Ana Paula", time: "há 5h atrás" },
  { initial: "R", name: "Ricardo S.", time: "há 19h atrás" },
  { initial: "F", name: "Fernanda L.", time: "há 1d atrás" },
];

const REF_LINK = "https://bolao.com/ref/SEU_CODIGO";

/** Métricas do link — desktop, abaixo do campo (mock; ligar à API depois) */
const LINK_STATS_DESKTOP = {
  compartilhamentos: 48,
  cliquesUnicos: 215,
  taxaConversao: "15,8",
} as const;

/* ─── Page ─── */
export default function IndiqueGanhePage() {
  const [amigos, setAmigos] = useState(10);
  const [copied, setCopied] = useState(false);

  const ganhoOuro = amigos * 12;
  const ganhoDiamante = amigos * 20;

  function handleCopy() {
    navigator.clipboard.writeText(REF_LINK).catch(() => { });
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

      <div className="max-w-[430px] md:max-w-[1400px] mx-auto px-3.5 md:px-8 pt-3.5 md:pt-8">
        <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_380px] md:gap-6 md:items-start">

          <div className="flex flex-col gap-3 md:gap-4">
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

              <h1 className="text-[26px] font-black text-white leading-[1.2] tracking-[-0.01em] mb-2.5 block md:hidden">
                Indique amigos e<br />ganhe dinheiro
              </h1>
              <h1 className="text-[38px] font-black text-white leading-[1.2] tracking-[-0.01em] mb-2.5 hidden md:block">
                Indique amigos e <span className="text-[#FFE8BA]"> ganhe dinheiro</span>
              </h1>
              <p className="text-[13px] leading-[1.6] mb-5 block md:hidden" style={{ color: "rgba(255,255,255,0.45)" }}>
                Cada amigo que comprar um ticket rende{" "}
                <span className="font-bold" style={{ color: C.goldMid }}>R$12,00</span> direto pra você.
              </p>
              <p className="text-[15px] leading-[1.6] mb-5 hidden md:block w-2/3" style={{ color: "rgba(255,255,255,0.45)" }}>
                Cada amigo que comprar um ticket vale{" "}
                <span className="font-bold" style={{ color: C.goldMid }}>R$12,00 direto pra você</span>. Quanto mais indicações, maior o nível e maior o bônus por amigo.
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
                <div
                  className="hidden items-center gap-2 px-3 py-2.5 rounded-[10px] md:hidden"
                  style={{ background: "rgba(255,232,186,0.08)", border: "1px solid rgba(212,175,55,0.22)" }}
                >
                  <Zap size={13} style={{ color: C.gold }} className="shrink-0" />
                  <p className="text-[11px] leading-[1.55]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Faltam <span className="font-bold text-white">16 indicações</span> para{" "}
                  <span className="font-bold" style={{ color: C.platinum }}>Diamante</span>{" "}—{" "}
                  <span className="font-bold" style={{ color: C.goldMid }}>ganhe R$20/ind</span>
                  </p>
                </div>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] md:hidden"
                style={{ background: "rgba(255,232,186,0.08)", border: "1px solid rgba(212,175,55,0.22)" }}
              >
                <Zap size={13} style={{ color: C.gold }} className="shrink-0" />
                <p className="text-[11px] leading-[1.55]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Faltam <span className="font-bold text-white">16 indicações</span> para{" "}
                  <span className="font-bold" style={{ color: C.platinum }}>Diamante</span>{" "}—{" "}
                  <span className="font-bold" style={{ color: C.goldMid }}>ganhe R$20/ind</span>
                </p>
              </div>
            </div>

            {/* ── SEU PROGRESSO — mobile only ── */}
            <div className="md:hidden">
              <SmallLabel className="mb-2.5">Seu Progresso</SmallLabel>
              <div className="grid grid-cols-3 gap-2">
                <StatCard Icon={MousePointerClick} iconColor="rgba(255,255,255,0.45)" value="215" label="Cliques" />
                <StatCard Icon={UserPlus} iconColor={C.gold} value="34+" label="Indicações" valueColor={C.gold} />
                <StatCard Icon={Wallet} iconColor={C.gain} value="R$212" label="Ganhos" valueColor={C.gain} highlight />
              </div>
            </div>

            {/* ── SEU LINK DE INDICAÇÃO — desktop only ── */}
            <div
              className="hidden md:block rounded-2xl p-5"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <SectionHeader>Seu link de indicação</SectionHeader>

              <div className="flex items-start gap-2.5 mt-4">
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div
                    className="w-full rounded-[10px] px-3.5 py-3 text-[12px] truncate flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.gain, boxShadow: `0 0 6px ${C.gain}80` }} aria-hidden />
                    <span className="truncate">{REF_LINK}</span>
                  </div>
                  <p className="text-[11px] leading-[1.5] pl-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                    <span className="font-bold text-white">{LINK_STATS_DESKTOP.compartilhamentos}</span>
                    {" "}compartilhamentos
                    <span className="mx-1.5 opacity-40">·</span>
                    <span className="font-bold text-white">{LINK_STATS_DESKTOP.cliquesUnicos}</span>
                    {" "}cliques únicos
                    <span className="mx-1.5 opacity-40">·</span>
                    <span className="font-bold text-white">{LINK_STATS_DESKTOP.taxaConversao}%</span>
                    {" "}taxa de conversão
                  </p>
                </div>
                <button
                  onClick={handleCopy}
                  className="h-[42px] px-5 rounded-[10px] text-[13px] font-black tracking-[0.04em] flex items-center gap-2 shrink-0 active:scale-[0.97]"
                  style={{
                    transition: "transform 0.1s ease, background 0.3s ease",
                    ...(copied
                      ? { background: `linear-gradient(135deg, #8B6914, ${C.gold} 55%, #FFE8BA)`, color: "#0E141B" }
                      : { background: `linear-gradient(135deg, #E89520, ${C.goldMid} 50%, #FFD96A)`, color: "#0E141B" }
                    ),
                  }}
                >
                  {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={2.5} />}
                  {copied ? "Copiado!" : "Copiar Link"}
                </button>
                <div className="flex gap-2.5 shrink-0">
                  <button
                    className="flex px-4 items-center justify-center gap-2 h-[42px] rounded-[10px] text-[12px] font-bold whitespace-nowrap"
                    style={{ background: "#25D36618", border: "1px solid #25D36630", color: "#25D366" }}
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    WhatsApp
                  </button>
                  <button
                    className="flex px-4 items-center justify-center gap-2 h-[42px] rounded-[10px] text-[12px] font-bold whitespace-nowrap"
                    style={{
                      background: "rgba(255,232,186,0.08)",
                      border: "1px solid rgba(212,175,55,0.22)",
                      color: C.goldMid,
                    }}
                    type="button"
                  >
                    <Share2 size={13} className="shrink-0" style={{ color: C.gold }} />
                    Compartilhar
                  </button>
                </div>
              </div>

            </div>

            {/* ── COMO FUNCIONA ── */}
            <div
              className="rounded-2xl p-5 hidden md:block"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <SectionHeader>Como Funciona</SectionHeader>

              <div className="flex flex-col md:flex-row gap-2.5 mt-4">
                {HOW_STEPS.map((step, i) => {
                  const Icon = step.Icon;
                  return (
                    <div
                      key={i}
                      className="flex md:flex-col items-start md:items-start gap-3.5 rounded-[14px] p-4 md:flex-1"
                      style={{ background: C.nested, border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div
                        className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center shrink-0"
                        style={{ background: `${step.color}18`, border: `1px solid ${step.color}28` }}
                      >
                        <Icon size={20} style={{ color: step.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
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

            <div
              className="rounded-2xl p-5 hidden md:block"
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
                      <div
                        className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-[15px] font-black shrink-0"
                        style={{ background: `rgba(255, 255, 255, 0.07)`, border: `1.5px solid rgba(255, 255, 255, 0.2)`, color: "rgba(255, 255, 255, 0.5)" }}
                      >
                        {item.initial}
                      </div>

                      <div>
                        <p className="text-[13px] leading-none mb-1">
                          <span className="font-bold text-white">{item.name}</span>
                          <span style={{ color: "rgba(255,255,255,0.45)" }}> comprou um ticket</span>
                        </p>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>{item.time}</p>
                      </div>
                    </div>

                    <span
                      className="text-[12px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
                      style={{ color: C.gain, background: C.gainSoft, border: "1px solid rgba(34,197,94,0.28)" }}
                    >
                      +R$8
                    </span>
                  </div>
                ))}
              </div>

            </div>

          </div>
          {/* ══ END LEFT COLUMN ══ */}

          {/* ══ RIGHT COLUMN ══ */}
          <div className="flex flex-col gap-3 md:gap-4">

            {/* ── JORNADA DE NÍVEIS ── */}
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
                  <span className="text-[13px] font-extrabold px-3 py-1.5 rounded-[8px]" style={{ background: C.gainSoft, border: "1px solid rgba(34,197,94,0.28)", color: C.gain }}>
                    +R$8
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: "rgba(255,255,255,0.30)" }}>No Diamante</p>
                  <p className="text-[36px] font-black leading-none tracking-[-0.02em]" style={{ background: `linear-gradient(135deg, #F8FAFC, ${C.platinum} 45%, ${C.goldLight} 95%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    R$20
                  </p>
                  <p className="text-[11px] mt-1.5" style={{ color: "rgba(255,255,255,0.28)" }}>por indic.</p>
                </div>
              </div>

              <div className="h-[6px] rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="h-full w-[68%] rounded-full" style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.goldMid} 55%, ${C.platinumMuted})` }} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                  <span className="font-bold text-white">34</span> de 50 indicações
                </p>
                <div className="flex items-center gap-1">
                  <Gem size={10} style={{ color: C.platinum }} />
                  <span className="text-[12px] font-bold" style={{ color: C.platinum }}>+16 para Diamante</span>
                </div>
              </div>
            </div>

            {/* ── SIMULE SEUS GANHOS ── */}
            <div
              className="rounded-2xl"
              style={{ background: C.card }}
            >
              <div className="px-4 pt-4 pb-4">
                <SectionHeader>Simule seus Ganhos</SectionHeader>
              </div>
              <div className="px-5 pb-5">
                <p className="text-[12px] mb-5" style={{ color: "rgba(255,255,255,0.36)" }}>
                  Quantos amigos você consegue indicar?
                </p>

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
                    style={{ height: 40 }}
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

                <div
                  className="rounded-[14px] px-5 pt-5 pb-4 mb-4 text-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(255,232,186,0.06) 100%)",
                    border: "1px solid #FFE8BA33",
                  }}
                >
                  <p className="text-[14px] mb-3" style={{ color: "#FFFFFF59" }}>
                    No nível{" "}
                    <span className="font-bold" style={{ color: C.goldMid }}>Ouro</span>
                    {" "}você ganharia
                  </p>

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

                  <div className="flex items-center justify-center gap-1.5 bg-[#FAD98B14] py-3 border-2 border-[#FAD98B33] rounded-[10px]">
                    <Gem size={11} style={{ color: "#FAD98B" }} />
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

                <button
                  onClick={handleCopy}
                  className="w-full h-[52px] rounded-[10px] text-[14px] font-black tracking-[0.06em] uppercase  items-center justify-center gap-2 active:scale-[0.98] flex md:hidden"
                  style={{
                    transition: "transform 0.1s ease, box-shadow 0.3s ease, background 0.3s ease",
                    border: "none",
                    ...(copied
                      ? { background: `linear-gradient(135deg, #8B6914, ${C.gold} 55%, #FFE8BA)`, color: "#0E141B", boxShadow: `0 0 20px ${C.goldMid}35` }
                      : { background: `linear-gradient(135deg, #E89520, ${C.goldMid} 50%, #FFD96A)`, color: "#0E141B", boxShadow: `0 0 24px ${C.goldMid}40, 0 4px 14px rgba(0,0,0,0.5)` }
                    ),
                  }}
                >
                  {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} strokeWidth={2.5} />}
                  {copied ? "Link Copiado!" : "Copiar Link Agora"}
                </button>
              </div>
            </div>
            <div
              className="rounded-2xl p-5 block md:hidden"
              style={{ background: C.card, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <SectionHeader>Como Funciona</SectionHeader>

              <div className="flex flex-col md:flex-row gap-2.5 mt-4">
                {HOW_STEPS.map((step, i) => {
                  const Icon = step.Icon;
                  return (
                    <div
                      key={i}
                      className="flex md:flex-col items-start md:items-start gap-3.5 rounded-[14px] p-4 md:flex-1"
                      style={{ background: C.nested, border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div
                        className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center shrink-0"
                        style={{ background: `${step.color}18`, border: `1px solid ${step.color}28` }}
                      >
                        <Icon size={20} style={{ color: step.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
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
            {/* ── ATIVIDADE RECENTE ── */}
            <div
              className="rounded-2xl p-5 block md:hidden"
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
                      <div
                        className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-[15px] font-black shrink-0"
                        style={{ background: `rgba(255, 255, 255, 0.07)`, border: `1.5px solid rgba(255, 255, 255, 0.2)`, color: "rgba(255, 255, 255, 0.5)" }}
                      >
                        {item.initial}
                      </div>

                      <div>
                        <p className="text-[13px] leading-none mb-1">
                          <span className="font-bold text-white">{item.name}</span>
                          <span style={{ color: "rgba(255,255,255,0.45)" }}> comprou um ticket</span>
                        </p>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>{item.time}</p>
                      </div>
                    </div>

                    <span
                      className="text-[12px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
                      style={{ color: C.gain, background: C.gainSoft, border: "1px solid rgba(34,197,94,0.28)" }}
                    >
                      +R$8
                    </span>
                  </div>
                ))}
              </div>

              <button
                className="w-full flex items-center justify-center gap-1 mt-3 pt-3 text-[12px] font-semibold transition-opacity hover:opacity-70"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.38)" }}
              >
                Ver todo histórico
                <ChevronRight size={13} />
              </button>
            </div>

          </div>
          {/* ══ END RIGHT COLUMN ══ */}

        </div>

        {/* ══ TRUST BAR — full width ══ */}
        <div
          className="rounded-2xl mt-3 md:mt-5 block md:hidden"
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b-[#FFFFFF0F]">
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
        background: highlight ? "rgba(6,20,14,0.65)" : C.nested,
        border: highlight ? "1px solid rgba(34,197,94,0.22)" : "1px solid rgba(255,255,255,0.07)",
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

/** Inline stat card for desktop hero row */
function StatCardInline({
  Icon, iconColor, value, valueColor = "#fff", label, highlight = false,
}: {
  Icon: React.ElementType; iconColor: string;
  value: string; valueColor?: string;
  label: string; highlight?: boolean;
}) {
  return (
    <div
      className="flex-1 flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background: highlight ? "rgba(6,20,14,0.65)" : "rgba(255,255,255,0.03)",
        border: highlight ? "1px solid rgba(34,197,94,0.22)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        className="w-[36px] h-[36px] rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${iconColor}20`, border: `1px solid ${iconColor}30` }}
      >
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div>
        <p className="text-[18px] font-black leading-none" style={{ color: valueColor }}>{value}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: "rgba(255,255,255,0.32)" }}>{label}</p>
      </div>
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
