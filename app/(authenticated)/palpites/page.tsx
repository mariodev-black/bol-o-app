"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, BarChart2, Trophy, AlignJustify } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────
type TabView = "jogos" | "tabela" | "ranking";
type StatusJogo = "aberto" | "encerrado";

interface ClassificacaoTime {
  posicao: number;
  pontos: number;
  time: { time_id: number; nome_popular: string; sigla: string; escudo: string };
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
}
type TabelaGrupos = Record<string, ClassificacaoTime[]>;

interface Jogo {
  id: number;
  timeCasa: string;
  siglasCasa: string;
  escudoCasa: string;
  timeVisitante: string;
  siglasVisitante: string;
  escudoVisitante: string;
  data: string;
  hora: string;
  status: StatusJogo;
  grupo: string;
  rodada: number;
}

// ── Helpers ──────────────────────────────────────────────────
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const RODADA_KEYS = ["1a-rodada", "2a-rodada", "3a-rodada"] as const;
const RODADAS_LABEL = ["1ª Rodada", "2ª Rodada", "3ª Rodada"];

function formatData(dataStr: string): string {
  const [day, month] = dataStr.split("/");
  return `${MESES[parseInt(month) - 1]}. ${parseInt(day)}`;
}

function mapStatus(s: string): StatusJogo {
  if (s === "encerrado" || s === "cancelado" || s === "finalizado") return "encerrado";
  return "aberto";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePartidas(faseGrupos: Record<string, any>): Jogo[] {
  const jogos: Jogo[] = [];
  const grupoKeys = Object.keys(faseGrupos).filter((k) => k.startsWith("grupo-"));

  for (const grupoKey of grupoKeys) {
    const grupoLetra = grupoKey.replace("grupo-", "").toUpperCase();
    const grupoData = faseGrupos[grupoKey];

    RODADA_KEYS.forEach((rodadaKey, rodadaIndex) => {
      const partidas = grupoData[rodadaKey] ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of partidas) {
        jogos.push({
          id: p.partida_id,
          timeCasa: p.time_mandante.nome_popular.toUpperCase(),
          siglasCasa: p.time_mandante.sigla,
          escudoCasa: p.time_mandante.escudo,
          timeVisitante: p.time_visitante.nome_popular.toUpperCase(),
          siglasVisitante: p.time_visitante.sigla,
          escudoVisitante: p.time_visitante.escudo,
          data: formatData(p.data_realizacao),
          hora: p.hora_realizacao,
          status: mapStatus(p.status),
          grupo: grupoLetra,
          rodada: rodadaIndex,
        });
      }
    });
  }

  return jogos;
}

// ── Escudo do time ────────────────────────────────────────────
function Escudo({ url, alt }: { url: string; alt: string }) {
  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden"
      style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="w-10 h-10 object-contain" />
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden mb-3 bg-[#0A0E19] border border-white/[0.07] animate-pulse">
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-white/10 rounded" />
          <div className="h-3 w-20 bg-white/5 rounded" />
        </div>
        <div className="h-6 w-20 bg-white/10 rounded-full" />
      </div>
      <div className="mx-5 h-px bg-white/10" />
      <div className="flex items-center justify-between px-5 py-5 gap-2">
        <div className="w-14 h-14 rounded-2xl bg-white/10" />
        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/10" />
          <div className="w-10 h-8 bg-white/10 rounded" />
          <div className="w-9 h-9 rounded-xl bg-white/10" />
        </div>
        <div className="w-6 h-6 bg-white/10 rounded" />
        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/10" />
          <div className="w-10 h-8 bg-white/10 rounded" />
          <div className="w-9 h-9 rounded-xl bg-white/10" />
        </div>
        <div className="w-14 h-14 rounded-2xl bg-white/10" />
      </div>
      <div className="mx-5 h-px bg-white/10 mb-5" />
      <div className="px-4 pb-4">
        <div className="w-full h-12 rounded-xl bg-white/10" />
      </div>
    </div>
  );
}

// ── Score animado ─────────────────────────────────────────────
function ScoreDisplay({ value, dir }: { value: number; dir: "up" | "down" }) {
  return (
    <div className="h-11 w-10 overflow-hidden relative flex items-center justify-center">
      <span
        key={value}
        className={`text-white font-black text-4xl leading-none absolute ${dir === "up" ? "animate-score-up" : "animate-score-down"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Card do jogo ──────────────────────────────────────────────
function JogoCard({ jogo }: { jogo: Jogo }) {
  const [scoreCasa, setScoreCasa] = useState(0);
  const [scoreVisitante, setScoreVisitante] = useState(0);
  const [dirCasa, setDirCasa] = useState<"up" | "down">("up");
  const [dirVisitante, setDirVisitante] = useState<"up" | "down">("up");
  const [palpiteSalvo, setPalpiteSalvo] = useState(false);

  function increment(side: "casa" | "visitante") {
    if (side === "casa") { setDirCasa("up"); setScoreCasa((v) => Math.min(v + 1, 99)); }
    else { setDirVisitante("up"); setScoreVisitante((v) => Math.min(v + 1, 99)); }
  }
  function decrement(side: "casa" | "visitante") {
    if (side === "casa") { setDirCasa("down"); setScoreCasa((v) => Math.max(v - 1, 0)); }
    else { setDirVisitante("down"); setScoreVisitante((v) => Math.max(v - 1, 0)); }
  }

  const disabled = jogo.status !== "aberto" || palpiteSalvo;

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3 bg-[#0A0E19]"
      style={{ border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Topo */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-white font-extrabold text-[15px] tracking-wide">
            {jogo.timeCasa}
          </p>
          <p className="text-white/40 text-[12px] mt-0.5">VS {jogo.timeVisitante}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[#FFE8BA] text-[12px] font-medium">
            {jogo.data}, {jogo.hora}
          </span>
          {jogo.status === "aberto" && !palpiteSalvo && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "#22C55E1A", border: "2px solid #22C55E33" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-[11px] font-bold text-[#22C55E] uppercase tracking-wide">Aberto</span>
            </div>
          )}
          {palpiteSalvo && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "rgba(254,197,84,0.12)", border: "1px solid rgba(254,197,84,0.25)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FEC554" }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#FEC554" }}>Salvo</span>
            </div>
          )}
          {jogo.status === "encerrado" && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <span className="text-[11px] font-bold text-white/30 uppercase tracking-wide">Encerrado</span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-5 h-px bg-[#ffffff31]" />

      {/* Área de palpite */}
      <div className="flex items-center justify-between px-5 py-5 gap-2">
        <Escudo url={jogo.escudoCasa} alt={jogo.timeCasa} />

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => increment("casa")}
            disabled={disabled}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity bg-[#252F42]"
            style={{ opacity: disabled ? 0.3 : 1 }}
          >
            <ChevronUp className="w-4 h-4 text-[#FFE8BA]" />
          </button>
          <ScoreDisplay value={scoreCasa} dir={dirCasa} />
          <button
            onClick={() => decrement("casa")}
            disabled={disabled}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity bg-[#252F42]"
            style={{ opacity: disabled ? 0.3 : 1 }}
          >
            <ChevronDown className="w-4 h-4 text-[#FFE8BA]" />
          </button>
        </div>

        <span className="text-white/20 font-light text-2xl mb-1">×</span>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => increment("visitante")}
            disabled={disabled}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity bg-[#252F42]"
            style={{ opacity: disabled ? 0.3 : 1 }}
          >
            <ChevronUp className="w-4 h-4 text-[#FFE8BA]" />
          </button>
          <ScoreDisplay value={scoreVisitante} dir={dirVisitante} />
          <button
            onClick={() => decrement("visitante")}
            disabled={disabled}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity bg-[#252F42]"
            style={{ opacity: disabled ? 0.3 : 1 }}
          >
            <ChevronDown className="w-4 h-4 text-[#FFE8BA]" />
          </button>
        </div>

        <Escudo url={jogo.escudoVisitante} alt={jogo.timeVisitante} />
      </div>

      <div className="mx-5 h-px bg-[#ffffff31] mb-5" />

      {/* Botão */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setPalpiteSalvo(true)}
          disabled={disabled}
          className="w-full py-3.5 rounded-xl font-black text-[16px] transition-all duration-200"
          style={{
            background: palpiteSalvo
              ? "rgba(52,211,153,0.15)"
              : disabled
              ? "#0A0E19"
              : "#fff",
            color: palpiteSalvo ? "#34D399" : disabled ? "rgba(255,255,255,0.2)" : "#0A0E19",
            border: palpiteSalvo ? "1px solid rgba(52,211,153,0.3)" : "none",
          }}
        >
          {palpiteSalvo ? "✓ Palpite enviado!" : "Fazer Palpite"}
        </button>
      </div>
    </div>
  );
}

// ── Tabela de classificação ───────────────────────────────────
function TabelaView({ grupo, tabela, onGrupo }: { grupo: string; tabela: TabelaGrupos | null; onGrupo: (g: string) => void }) {
  if (!tabela) {
    return (
      <div className="flex flex-col items-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin mb-3" />
        <p className="text-white/30 text-sm">Carregando tabela...</p>
      </div>
    );
  }

  const grupoKey = `grupo-${grupo.toLowerCase()}`;
  const times = tabela[grupoKey] ?? [];
  const todosGrupos = Object.entries(tabela)
    .filter(([k]) => k.startsWith("grupo-"))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      {/* Classificação do grupo selecionado */}
      <div
        className="rounded-2xl overflow-hidden mb-5"
        style={{ background: "#0A0E19", border: "1px solid #FFFFFF12" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-white font-bold text-[14px]">
            Classificação — Grupo {grupo}
          </span>
          <div className="flex gap-4">
            {["PTS", "J", "V", "E", "D"].map((col) => (
              <span key={col} className="text-[11px] font-bold text-white/30 w-5 text-center">{col}</span>
            ))}
          </div>
        </div>

        {/* Linhas */}
        {times.map((t, i) => (
          <div
            key={t.time.time_id}
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: i < 2 ? "#5AADFF08" : "transparent",
              borderBottom: i < times.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-5 h-5 rounded-[6px] flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{
                  background: i === 0 ? "rgba(254,197,84,0.15)" : "rgba(255,255,255,0.06)",
                  color: i === 0 ? "#FEC554" : "rgba(255,255,255,0.4)",
                }}
              >
                {t.posicao}
              </span>
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden shrink-0"
                style={{ background: "rgba(255,255,255,0.9)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.time.escudo} alt={t.time.sigla} className="w-5 h-5 object-contain" />
              </div>
              <span className="text-white font-bold text-[13px] tracking-wide">{t.time.sigla}</span>
            </div>
            <div className="flex gap-4">
              {[t.pontos, t.jogos, t.vitorias, t.empates, t.derrotas].map((val, vi) => (
                <span
                  key={vi}
                  className="w-5 text-center text-[13px] font-bold"
                  style={{ color: vi === 0 ? "#fff" : "rgba(255,255,255,0.35)" }}
                >
                  {val}
                </span>
              ))}
            </div>
          </div>
        ))}

        {times.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-white/20 text-sm">Sem dados para este grupo</p>
          </div>
        )}
      </div>

      {/* Outros grupos */}
      {todosGrupos.length > 0 && (
        <>
          <p className="text-[11px] font-bold text-white/30 tracking-widest uppercase mb-3">
            Grupos
          </p>
          <div className="flex flex-col gap-2">
            {Array.from({ length: Math.ceil(todosGrupos.length / 2) }, (_, ri) =>
              todosGrupos.slice(ri * 2, ri * 2 + 2)
            ).map((row, ri) => (
              <div key={ri} className="flex gap-2">
                {row.map(([key, rowTimes]) => {
                  const letra = key.replace("grupo-", "").toUpperCase();
                  const lider = rowTimes[0];
                  const ativo = letra === grupo;
                  if (!lider) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => onGrupo(letra)}
                      className="flex-1 flex items-center gap-2.5 px-3 py-3 rounded-xl text-left transition-all duration-150"
                      style={{
                        background: ativo ? "rgba(255,175,47,0.08)" : "#0A0E19",
                        border: ativo ? "1px solid rgba(255,175,47,0.25)" : "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[12px] font-black shrink-0"
                        style={{
                          background: ativo ? "rgba(255,175,47,0.2)" : "rgba(255,255,255,0.07)",
                          color: ativo ? "#FFAF2F" : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {letra}
                      </span>
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden shrink-0"
                        style={{ background: "rgba(255,255,255,0.9)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={lider.time.escudo} alt={lider.time.sigla} className="w-5 h-5 object-contain" />
                      </div>
                      <span className="font-bold text-[12px] flex-1 truncate" style={{ color: ativo ? "#FFE8BA" : "#fff" }}>{lider.time.sigla}</span>
                      <span className="text-[11px] font-light" style={{ color: ativo ? "#FFAF2F" : "rgba(255,255,255,0.35)" }}>Lidera</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Ranking ───────────────────────────────────────────────────
const RANKING_MOCK = [
  { pos: 1, nome: "João Silva",    iniciais: "JS", acertos: 8, pts: 47, cor: "#F97316" },
  { pos: 2, nome: "Maria Santos",  iniciais: "MS", acertos: 7, pts: 43, cor: "#64748B" },
  { pos: 3, nome: "Pedro Costa",   iniciais: "PC", acertos: 7, pts: 41, cor: "#06B6D4" },
  { pos: 4, nome: "Ana Lima",      iniciais: "AL", acertos: 6, pts: 38, cor: "#7C3AED" },
  { pos: 5, nome: "Carlos Ferr.",  iniciais: "CF", acertos: 6, pts: 35, cor: "#10B981" },
  { pos: 6, nome: "Você",          iniciais: "OP", acertos: 5, pts: 32, cor: "#F97316", isMe: true },
  { pos: 7, nome: "Luciana M.",    iniciais: "LM", acertos: 4, pts: 28, cor: "#9333EA" },
];
const MEU = RANKING_MOCK.find((r) => r.isMe)!;

function MedalBadge({ pos }: { pos: number }) {
  if (pos === 1) return <span className="text-[20px] leading-none">🥇</span>;
  if (pos === 2) return <span className="text-[20px] leading-none">🥈</span>;
  if (pos === 3) return <span className="text-[20px] leading-none">🥉</span>;
  return (
    <span className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>
      #{pos}
    </span>
  );
}

function RankingView() {
  return (
    <div className="flex flex-col gap-3">

      {/* Minha posição */}
      <div
        className="rounded-2xl px-4 py-4"
        style={{ background: "linear-gradient(135deg, #F6D13B2E 0%, #F1E8631F 100%)", border: "1px solid rgba(80,120,40,0.25)" }}
      >
        <p className="text-[10px] text-[#FFFFFF8C] font-bold tracking-widest uppercase mb-3">
          Sua posição atual
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-black text-[14px] text-white"
                style={{ background: MEU.cor }}
              >
                {MEU.iniciais}
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px]"
                style={{ background: "#FFAF2F" }}
              >
                🪙
              </div>
            </div>
            <div>
              <p className="text-white font-black text-[18px] leading-tight">#{MEU.pos} no Ranking</p>
              <p className="text-[12px] mt-0.5 text-[#FDF293]">
                {MEU.acertos} acertos · {MEU.pts} pontos
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-black text-[34px] leading-none" style={{ color: "#FEE1A7" }}>{MEU.pts}</p>
            <p className="text-[10px] mt-0.5 text-[#FFFFFF59]">pontos</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: "🎯", val: 32, label: "Palpites" },
          { icon: "✅", val: 5,  label: "Acertos" },
          { icon: "⭐", val: 32, label: "Pontos" },
        ].map(({ icon, val, label }) => (
          <div
            key={label}
            className="rounded-2xl py-4 flex flex-col items-center gap-1"
            style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-[22px] leading-none mb-1">{icon}</span>
            <span className="text-white font-black text-[22px] leading-none">{val}</span>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Top Palpiteiros */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-white font-bold text-[14px]">Top Palpiteiros</span>
          <button className="text-[13px] font-semibold" style={{ color: "#5AADFF" }}>Ver todos</button>
        </div>

        {RANKING_MOCK.map((r, i) => (
          <div
            key={r.pos}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: r.isMe ? "rgba(90,173,255,0.06)" : "transparent",
              borderBottom: i < RANKING_MOCK.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            <div className="w-7 flex items-center justify-center shrink-0">
              <MedalBadge pos={r.pos} />
            </div>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] text-white shrink-0"
              style={{ background: r.cor }}
            >
              {r.iniciais}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-[13px] truncate">
                {r.nome}
                {r.isMe && (
                  <span className="text-[11px] font-normal ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    (você)
                  </span>
                )}
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{r.acertos} acertos</p>
            </div>
            <div className="shrink-0 flex items-baseline gap-0.5">
              <span
                className="font-black text-[16px]"
                style={{ color: r.isMe ? "#FFAF2F" : "#fff" }}
              >
                {r.pts}
              </span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
            </div>
          </div>
        ))}
      </div>

      {/* Prazo */}
      <div
        className="rounded-2xl px-4 py-4 flex items-start gap-3"
        style={{ background: "rgba(218,182,130,0.06)", border: "1px solid rgba(218,182,130,0.18)" }}
      >
        <span className="text-[22px] leading-none shrink-0" style={{ color: "#DAB682" }}>🔔</span>
        <div>
          <p className="font-bold text-[13px]" style={{ color: "#DAB682" }}>Prazo para palpitar</p>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "rgba(218,182,130,0.5)" }}>
            Os palpites são bloqueados 1 hora antes do início de cada partida. Não esqueça de salvar!
          </p>
        </div>
      </div>

    </div>
  );
}

// ── Página ───────────────────────────────────────────────────
export default function PalpitesPage() {
  const [tab, setTab] = useState<TabView>("jogos");
  const [grupo, setGrupo] = useState("");
  const [rodada, setRodada] = useState(0);
  const [rodadaOpen, setRodadaOpen] = useState(false);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [grupos, setGrupos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [tabela, setTabela] = useState<TabelaGrupos | null>(null);

  useEffect(() => {
    fetch("/api/tabela")
      .then((r) => r.json())
      .then((data) => {
        const fg = data?.["fase-de-grupos"];
        if (fg) setTabela(fg);
      })
      .catch(() => {});

    fetch("/api/partidas")
      .then((r) => r.json())
      .then((data) => {
        const faseGrupos = data?.partidas?.["fase-de-grupos"];
        if (!faseGrupos) { setErro(true); return; }

        const parsed = parsePartidas(faseGrupos);
        setJogos(parsed);

        const letras = Object.keys(faseGrupos)
          .filter((k) => k.startsWith("grupo-"))
          .map((k) => k.replace("grupo-", "").toUpperCase())
          .sort();
        setGrupos(letras);
        setGrupo(letras[0] ?? "");
      })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  }, []);

  const jogosFiltrados = jogos.filter(
    (j) => j.grupo === grupo && j.rodada === rodada
  );

  return (
    <div className="flex flex-col w-full max-w-lg mx-auto px-4 pt-6 pb-6">

      {/* Título */}
      <div className="mb-5">
        <h1 className="text-[28px] font-black text-white leading-tight">
          Copa do Mundo 2026
        </h1>
        <p className="text-white/40 text-[13px] mt-1">
          Fase de Grupos — {RODADAS_LABEL[rodada]}
        </p>
      </div>

      {/* Seletor de rodada */}
      {tab === "jogos" && <div className="relative mb-4">
        <button
          onClick={() => setRodadaOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-white font-semibold text-[14px]">{RODADAS_LABEL[rodada]}</span>
          </div>
          <ChevronDown
            className="w-4 h-4 text-white/40 transition-transform duration-200"
            style={{ transform: rodadaOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {rodadaOpen && (
          <div
            className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
            style={{ background: "#1a2030", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {RODADAS_LABEL.map((r, i) => (
              <button
                key={r}
                onClick={() => { setRodada(i); setRodadaOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/5"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: i === rodada ? "#34D399" : "rgba(255,255,255,0.2)" }}
                />
                <span
                  className="text-[14px] font-medium"
                  style={{ color: i === rodada ? "#fff" : "rgba(255,255,255,0.5)" }}
                >
                  {r}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 p-1 rounded-xl bg-[#0A0E19]">
        {(
          [
            { key: "jogos", label: "Jogos", icon: AlignJustify },
            { key: "tabela", label: "Tabela", icon: BarChart2 },
            { key: "ranking", label: "Ranking", icon: Trophy },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
            style={{
              background: tab === key ? "#161D2D" : "transparent",
              color: tab === key ? "#fff" : "rgba(255,255,255,0.35)",
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Filtro de grupos */}
      {grupos.length > 0 && tab !== "ranking" && (
        <div className="mb-5">
          <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase block mb-2">
            Grupo
          </span>
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: Math.ceil(grupos.length / 6) }, (_, ri) =>
              grupos.slice(ri * 6, ri * 6 + 6)
            ).map((row, ri) => (
              <div key={ri} className="flex gap-1.5">
                {row.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrupo(g)}
                    className="flex-1 h-9 rounded-lg text-[13px] font-bold transition-all duration-200"
                    style={{
                      background: grupo === g
                        ? "linear-gradient(180deg, #FFE8BA 0%, #FFAF2F 100%)"
                        : "#0A0E19",
                      color: grupo === g ? "#0E141B" : "rgba(255,255,255,0.4)",
                      boxShadow: grupo === g ? "0 0 14px rgba(255,175,47,0.45)" : "none",
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div key={tab} className="animate-tab-in">
        {tab === "jogos" && (
          <div>
            {erro ? (
              <div className="flex flex-col items-center py-16">
                <span className="text-4xl mb-3">⚠️</span>
                <p className="text-white/30 text-sm">Erro ao carregar partidas</p>
              </div>
            ) : loading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : jogosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <span className="text-4xl mb-3">⚽</span>
                <p className="text-white/30 text-sm">Nenhum jogo neste grupo</p>
              </div>
            ) : (
              jogosFiltrados.map((jogo) => <JogoCard key={jogo.id} jogo={jogo} />)
            )}
          </div>
        )}

        {tab === "tabela" && (
          <TabelaView grupo={grupo} tabela={tabela} onGrupo={setGrupo} />
        )}

        {tab === "ranking" && <RankingView />}
      </div>
    </div>
  );
}
