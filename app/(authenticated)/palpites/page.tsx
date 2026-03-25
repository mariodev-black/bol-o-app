"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, BarChart2, Trophy, AlignJustify, Target, CircleCheck, Star, Bell, Coins, AlertTriangle, Disc, Pencil } from "lucide-react";
import { TrophyGold, TrophySilver, TrophyBronze } from "@/app/shared/RankingAtual";
import bgPalpitesDesk from "@/app/assets/bg-palpites-desktop.png";
import { StepsBreadcrumb } from "../boloes/_components/StepsBreadcrumb";

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
function JogoCard({ jogo, readOnly = false }: { jogo: Jogo; readOnly?: boolean }) {
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

  const disabled = readOnly || jogo.status !== "aberto" || palpiteSalvo;
  const review = readOnly
    ? {
        casa: (jogo.id * 3) % 5,
        visitante: (jogo.id * 7) % 4,
        pontos: ((jogo.id % 5) + (jogo.id % 3)) % 8,
      }
    : null;

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
          {readOnly && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)" }}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#93C5FD" }}>Resultado</span>
            </div>
          )}
          {!readOnly && jogo.status === "aberto" && !palpiteSalvo && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "#22C55E1A", border: "2px solid #22C55E33" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-[11px] font-bold text-[#22C55E] uppercase tracking-wide">Aberto</span>
            </div>
          )}
          {!readOnly && palpiteSalvo && (
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

        {readOnly ? (
          <div className="flex items-center gap-2">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[26px] font-black"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
            >
              {review?.casa}
            </div>
            <span className="text-white/25 font-light text-2xl">×</span>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[26px] font-black"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
            >
              {review?.visitante}
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}

        <Escudo url={jogo.escudoVisitante} alt={jogo.timeVisitante} />
      </div>

      <div className="mx-5 h-px bg-[#ffffff31] mb-5" />

      {/* Botão */}
      <div className="px-4 pb-4">
        {readOnly ? (
          <div
            className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2"
            style={{
              background: review && review.pontos > 0 ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
              border: review && review.pontos > 0 ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.14)",
            }}
          >
            <span
              className="font-black text-[14px]"
              style={{ color: review && review.pontos > 0 ? "#4ADE80" : "rgba(255,255,255,0.72)" }}
            >
              {review && review.pontos > 0
                ? `Voce ganhou ${review.pontos} pts nesta partida`
                : "Sem pontuacao nesta partida"}
            </span>
          </div>
        ) : palpiteSalvo ? (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2"
              style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}
            >
              <CircleCheck className="w-4 h-4" style={{ color: "#34D399" }} strokeWidth={2.5} />
              <span className="font-black text-[15px]" style={{ color: "#34D399" }}>Palpite salvo</span>
            </div>
            {jogo.status === "aberto" && (
              <button
                onClick={() => setPalpiteSalvo(false)}
                className="h-[50px] px-4 rounded-xl flex items-center gap-1.5 transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Pencil className="w-3.5 h-3.5 text-white/50" strokeWidth={2} />
                <span className="text-[13px] font-semibold text-white/50">Editar</span>
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setPalpiteSalvo(true)}
            disabled={jogo.status !== "aberto"}
            className="w-full py-3.5 rounded-xl font-black text-[16px] transition-all duration-200"
            style={{
              background: jogo.status !== "aberto" ? "#0A0E19" : "#fff",
              color: jogo.status !== "aberto" ? "rgba(255,255,255,0.2)" : "#0A0E19",
            }}
          >
            Fazer Palpite
          </button>
        )}
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
                          color: ativo ? "#D4AF37" : "rgba(255,255,255,0.5)",
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
                      <span className="text-[11px] font-light" style={{ color: ativo ? "#D4AF37" : "rgba(255,255,255,0.35)" }}>Lidera</span>
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
  { pos: 1, nome: "João Silva",    iniciais: "JS", acertos: 8, pts: 47 },
  { pos: 2, nome: "Maria Santos",  iniciais: "MS", acertos: 7, pts: 43 },
  { pos: 3, nome: "Pedro Costa",   iniciais: "PC", acertos: 7, pts: 41 },
  { pos: 4, nome: "Ana Lima",      iniciais: "AL", acertos: 6, pts: 38 },
  { pos: 5, nome: "Carlos Ferr.",  iniciais: "CF", acertos: 6, pts: 35 },
  { pos: 6, nome: "Você",          iniciais: "OP", acertos: 5, pts: 32, isMe: true },
  { pos: 7, nome: "Luciana M.",    iniciais: "LM", acertos: 4, pts: 28 },
];
const MEU = RANKING_MOCK.find((r) => r.isMe)!;

function RankingMedal({ pos, size = 28 }: { pos: number; size?: number }) {
  if (pos === 1) return <TrophyGold size={size} />;
  if (pos === 2) return <TrophySilver size={size} />;
  if (pos === 3) return <TrophyBronze size={size} />;
  return <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>#{pos}</span>;
}

function RankingAvatar({ iniciais, isMe, size = 32 }: { iniciais: string; isMe?: boolean; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: isMe ? "rgba(218,182,130,0.15)" : "rgba(255,255,255,0.07)",
        color: isMe ? "#DAB682" : "rgba(255,255,255,0.5)",
        border: isMe ? "1px solid rgba(218,182,130,0.25)" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {iniciais}
    </div>
  );
};


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
              <RankingAvatar iniciais={MEU.iniciais} isMe size={44} />
              <div
                className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                style={{ background: "#D4AF37" }}
              >
                <Coins className="w-2.5 h-2.5" style={{ color: "#0E141B" }} strokeWidth={2.5} />
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
          { Icon: Target,       val: 32, label: "Palpites", color: "#D4AF37" },
          { Icon: CircleCheck,  val: 5,  label: "Acertos",  color: "#34D399" },
          { Icon: Star,         val: 32, label: "Pontos",   color: "#DAB682" },
        ].map(({ Icon, val, label, color }) => (
          <div
            key={label}
            className="rounded-2xl py-4 flex flex-col items-center gap-1"
            style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Icon className="w-5 h-5 mb-1" style={{ color }} strokeWidth={2} />
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
            <div className="w-7 h-7 flex items-center justify-center shrink-0">
              <RankingMedal pos={r.pos} size={28} />
            </div>
            <RankingAvatar iniciais={r.iniciais} isMe={r.isMe} size={36} />
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
                style={{ color: r.isMe ? "#D4AF37" : "#fff" }}
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
        <Bell className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#DAB682" }} strokeWidth={2} />
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

// ── Sidebar desktop ───────────────────────────────────────────
function DesktopSidebar({ grupo, tabela, grupos, onGrupo }: {
  grupo: string;
  tabela: TabelaGrupos | null;
  grupos: string[];
  onGrupo: (g: string) => void;
}) {
  const grupoKey = `grupo-${grupo.toLowerCase()}`;
  const times = tabela ? (tabela[grupoKey] ?? []) : [];
  const idx = grupos.indexOf(grupo);
  const prev = idx > 0 ? grupos[idx - 1] : null;
  const next = idx < grupos.length - 1 ? grupos[idx + 1] : null;

  return (
    <div className="flex flex-col gap-3 sticky top-6">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { Icon: Target,       val: 32, label: "Palpites", color: "#D4AF37" },
          { Icon: CircleCheck,  val: 5,  label: "Acertos",  color: "#34D399" },
          { Icon: Star,         val: 32, label: "Pontos",   color: "#DAB682" },
        ].map(({ Icon, val, label, color }) => (
          <div
            key={label}
            className="rounded-xl py-3 flex flex-col items-center gap-0.5"
            style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Icon className="w-4 h-4 mb-0.5" style={{ color }} strokeWidth={2} />
            <span className="text-white font-black text-[20px] leading-none">{val}</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Classificação */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0A0E19", border: "1px solid #FFFFFF12" }}>
        <div
          className="flex items-center justify-between px-4 py-3 gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Seta prev */}
          <button
            onClick={() => prev && onGrupo(prev)}
            disabled={!prev}
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-opacity"
            style={{ background: "rgba(255,255,255,0.06)", opacity: prev ? 1 : 0.25 }}
          >
            <ChevronDown className="w-3 h-3 text-white/60 rotate-90" />
          </button>

          {/* Título */}
          <span className="text-white font-bold text-[12px] flex-1 text-center truncate">
            Classificação — Grupo {grupo}
          </span>

          {/* Seta next */}
          <button
            onClick={() => next && onGrupo(next)}
            disabled={!next}
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-opacity"
            style={{ background: "rgba(255,255,255,0.06)", opacity: next ? 1 : 0.25 }}
          >
            <ChevronDown className="w-3 h-3 text-white/60 -rotate-90" />
          </button>

          {/* Colunas */}
          <div className="flex gap-2 shrink-0">
            {["PTS", "J", "V", "E", "D"].map((col) => (
              <span key={col} className="text-[9px] font-bold text-white/30 w-5 text-center">{col}</span>
            ))}
          </div>
        </div>

        {!tabela && (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        )}

        {times.map((t, i) => (
          <div
            key={t.time.time_id}
            className="flex items-center px-4 py-2.5 gap-2"
            style={{
              background: i < 2 ? "#5AADFF08" : "transparent",
              borderBottom: i < times.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            {/* Posição */}
            <span
              className="w-5 h-5 rounded-[5px] flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{
                background: i === 0 ? "rgba(254,197,84,0.15)" : "rgba(255,255,255,0.06)",
                color: i === 0 ? "#FEC554" : "rgba(255,255,255,0.4)",
              }}
            >
              {t.posicao}
            </span>
            {/* Escudo */}
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center overflow-hidden shrink-0"
              style={{ background: "rgba(255,255,255,0.92)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.time.escudo} alt={t.time.sigla} className="w-5 h-5 object-contain" />
            </div>
            {/* Sigla */}
            <span className="text-white font-bold text-[12px] flex-1 min-w-0 truncate">{t.time.sigla}</span>
            {/* Stats */}
            <div className="flex gap-2 shrink-0">
              {[t.pontos, t.jogos, t.vitorias, t.empates, t.derrotas].map((val, vi) => (
                <span
                  key={vi}
                  className="w-5 text-center text-[12px] font-bold"
                  style={{ color: vi === 0 ? "#fff" : "rgba(255,255,255,0.35)" }}
                >
                  {val}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Top Palpiteiros */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0A0E19", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-white font-bold text-[13px]">Top Palpiteiros</span>
          <button className="text-[12px] font-semibold" style={{ color: "#5AADFF" }}>Ver todos</button>
        </div>
        {RANKING_MOCK.map((r, i) => (
          <div
            key={r.pos}
            className="flex items-center gap-2.5 px-3 py-2.5"
            style={{
              background: r.isMe ? "rgba(90,173,255,0.07)" : "transparent",
              borderBottom: i < RANKING_MOCK.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}
          >
            {/* Medal / position */}
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <RankingMedal pos={r.pos} size={24} />
            </div>
            {/* Avatar */}
            <RankingAvatar iniciais={r.iniciais} isMe={r.isMe} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-[12px] truncate">
                {r.nome}
                {r.isMe && (
                  <span className="text-[10px] font-normal ml-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>(você)</span>
                )}
              </p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{r.acertos} acertos</p>
            </div>
            <div className="shrink-0 flex items-baseline gap-0.5">
              <span className="font-black text-[14px]" style={{ color: r.isMe ? "#D4AF37" : "#fff" }}>{r.pts}</span>
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
            </div>
          </div>
        ))}
      </div>

      {/* Prazo */}
      <div
        className="rounded-2xl px-4 py-4 flex items-start gap-3"
        style={{ background: "rgba(218,182,130,0.06)", border: "1px solid rgba(218,182,130,0.18)" }}
      >
        <Bell className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#DAB682" }} strokeWidth={2} />
        <div>
          <p className="font-bold text-[12px]" style={{ color: "#DAB682" }}>Prazo para palpitar</p>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "rgba(218,182,130,0.5)" }}>
            Os palpites são bloqueados 1 hora antes do início de cada partida. Não esqueça de salvar!
          </p>
        </div>
      </div>

    </div>
  );
}

// ── Página ───────────────────────────────────────────────────
export default function PalpitesPage() {
  const searchParams = useSearchParams();
  const hasBoloesFlow = Boolean(searchParams.get("bolao"));
  const resultMode = searchParams.get("mode") === "resultado";
  const ticketId = searchParams.get("ticket");
  const eventDate = searchParams.get("eventDate");
  const ranking = searchParams.get("ranking");
  const points = searchParams.get("points");
  const bolaoType = searchParams.get("bolao") === "diario" ? "diario" : "principal";
  const [tab, setTab] = useState<TabView>("jogos");
  const [grupo, setGrupo] = useState("");
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

  useEffect(() => {
    if (resultMode) setTab("jogos");
  }, [resultMode]);

  const jogosPorRodada = RODADAS_LABEL.map((label, idx) => ({
    label,
    jogos: jogos.filter((j) => j.grupo === grupo && j.rodada === idx),
  })).filter((r) => r.jogos.length > 0);

  const BotoesGrupo = ({ className }: { className?: string }) => (
    <div className={className}>
      <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase block mb-2">Grupo</span>
      {/* Mobile: chunked rows of 6 */}
      <div className="flex flex-col gap-1.5 lg:hidden">
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
                  background: grupo === g ? "linear-gradient(180deg, #FFE8BA 0%, #D4AF37 100%)" : "#0A0E19",
                  color: grupo === g ? "#0E141B" : "rgba(255,255,255,0.4)",
                  boxShadow: grupo === g ? "0 0 14px rgba(255,175,47,0.45)" : "none",
                }}
              >{g}</button>
            ))}
          </div>
        ))}
      </div>
      {/* Desktop: single flex row */}
      <div className="hidden lg:flex gap-1.5 flex-wrap">
        {grupos.map((g) => (
          <button
            key={g}
            onClick={() => setGrupo(g)}
            className="w-9 h-9 rounded-lg text-[13px] font-bold transition-all duration-200"
            style={{
              background: grupo === g ? "linear-gradient(180deg, #FFE8BA 0%, #D4AF37 100%)" : "#0A0E19",
              color: grupo === g ? "#0E141B" : "rgba(255,255,255,0.4)",
              boxShadow: grupo === g ? "0 0 14px rgba(255,175,47,0.45)" : "none",
            }}
          >{g}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-lg mx-auto px-4 pt-6 pb-8 lg:max-w-7xl">
      {hasBoloesFlow && (
        <div className="mb-4">
          <StepsBreadcrumb
            backHref={`/boloes/tickets?bolao=${bolaoType}`}
            items={["Bolões", "Tickets", "Palpites"]}
          />
        </div>
      )}

      {hasBoloesFlow && (
        <div
          className="mb-4 rounded-xl border px-4 py-3"
          style={{ background: "rgba(10,14,25,0.9)", borderColor: resultMode ? "rgba(59,130,246,0.35)" : "rgba(212,175,55,0.25)" }}
        >
          <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-white/45">
            {resultMode ? "Resumo do ticket (resultado)" : "Resumo do ticket"}
          </p>
          <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
            {ticketId && (
              <div className="rounded-lg px-2.5 py-2 text-[12px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)" }}>
                Ticket
                <p className="text-white font-semibold mt-0.5">{ticketId}</p>
              </div>
            )}
            {eventDate && (
              <div className="rounded-lg px-2.5 py-2 text-[12px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)" }}>
                Evento
                <p className="text-white font-semibold mt-0.5">{eventDate}</p>
              </div>
            )}
            {ranking && (
              <div className="rounded-lg px-2.5 py-2 text-[12px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)" }}>
                Ranking
                <p className="text-white font-semibold mt-0.5">#{ranking}</p>
              </div>
            )}
            {points && (
              <div className="rounded-lg px-2.5 py-2 text-[12px]" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)" }}>
                Pontos ganhos
                <p className="text-[#4ADE80] font-semibold mt-0.5">{points} pts</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Background desktop — cobre a tela inteira */}
      <div
        className="fixed inset-0 pointer-events-none hidden lg:block -z-10"
        style={{
          backgroundImage: `url(${bgPalpitesDesk.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          opacity: 0.07,
        }}
      />

      {/* Título */}
      <div className="mb-5 lg:mb-7">
        <h1 className="text-[28px] lg:text-[42px] font-black text-white leading-tight">
          Copa do Mundo 2026
        </h1>
        <p className="text-white/40 text-[13px] mt-1">Fase de Grupos</p>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">

        {/* ── COLUNA ESQUERDA ─────────────────────────── */}
        <div>

          {/* Mobile: tabs */}
          {!resultMode && (
            <div className="lg:hidden flex items-center gap-1 mb-5 p-1 rounded-xl bg-[#0A0E19]">
            {([
              { key: "jogos", label: "Jogos", icon: AlignJustify },
              { key: "tabela", label: "Tabela", icon: BarChart2 },
              { key: "ranking", label: "Ranking", icon: Trophy },
            ] as const).map(({ key, label, icon: Icon }) => (
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
          )}

          {/* Mobile: filtro grupos (exceto ranking) */}
          {grupos.length > 0 && tab !== "ranking" && !resultMode && (
            <div className="mb-5 lg:hidden">
              <BotoesGrupo />
            </div>
          )}

          {/* Desktop: filtro de grupos */}
          {grupos.length > 0 && !resultMode && (
            <div className="hidden lg:block mb-6">
              <BotoesGrupo />
            </div>
          )}

          {/* Mobile: conteúdo com tabs */}
          <div key={tab} className="animate-tab-in lg:hidden">
            {(tab === "jogos" || resultMode) && (
              <div>
                {erro ? (
                  <div className="flex flex-col items-center py-16">
                    <AlertTriangle className="w-10 h-10 mb-3 text-white/20" strokeWidth={1.5} />
                    <p className="text-white/30 text-sm">Erro ao carregar partidas</p>
                  </div>
                ) : loading ? (
                  <><CardSkeleton /><CardSkeleton /></>
                ) : jogosPorRodada.length === 0 ? (
                  <div className="flex flex-col items-center py-16">
                    <Disc className="w-10 h-10 mb-3 text-white/20" strokeWidth={1.5} />
                    <p className="text-white/30 text-sm">Nenhum jogo neste grupo</p>
                  </div>
                ) : (
                  jogosPorRodada.map(({ label, jogos: rJogos }) => (
                    <div key={label}>
                      <div className="flex items-center gap-3 mb-3 mt-1">
                        <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase shrink-0">{label}</span>
                        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                      </div>
                      {rJogos.map((jogo) => <JogoCard key={jogo.id} jogo={jogo} readOnly={resultMode} />)}
                    </div>
                  ))
                )}
              </div>
            )}
            {tab === "tabela" && !resultMode && <TabelaView grupo={grupo} tabela={tabela} onGrupo={setGrupo} />}
            {!resultMode && tab === "ranking" && <RankingView />}
          </div>

          {/* Desktop: grid 2 colunas de cards por rodada */}
          <div className="hidden lg:block">
            {erro ? (
              <div className="flex flex-col items-center py-16">
                <AlertTriangle className="w-10 h-10 mb-3 text-white/20" strokeWidth={1.5} />
                <p className="text-white/30 text-sm">Erro ao carregar partidas</p>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-2 gap-4">
                <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
              </div>
            ) : jogosPorRodada.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <Disc className="w-10 h-10 mb-3 text-white/20" strokeWidth={1.5} />
                <p className="text-white/30 text-sm">Nenhum jogo neste grupo</p>
              </div>
            ) : (
              jogosPorRodada.map(({ label, jogos: rJogos }) => (
                <div key={label} className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase shrink-0">{label}</span>
                    <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {rJogos.map((jogo) => <JogoCard key={jogo.id} jogo={jogo} readOnly={resultMode} />)}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* ── SIDEBAR DIREITA (desktop only) ───────────── */}
        {!resultMode && (
          <div className="hidden lg:block">
            <DesktopSidebar grupo={grupo} tabela={tabela} grupos={grupos} onGrupo={setGrupo} />
          </div>
        )}

      </div>
    </div>
  );
}
