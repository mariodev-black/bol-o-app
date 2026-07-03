"use client";

import { useMemo, useState } from "react";
import { Lock, Radio, Star, Ticket, X } from "lucide-react";
import { BottomNavEsportesIcon } from "@/app/shared/bottom-nav-icons";
import {
  SportBasketballIcon,
  SportEsportsIcon,
  SportTenisIcon,
  SportVoleiIcon,
} from "@/app/shared/sport-category-icons";

const GREEN = "#B1EB0B";

/**
 * Mockup visual da tela de Esportes (apostas com odds — fase 2, ainda sujeita
 * a validação jurídica/regulatória). Dados 100% ilustrativos: não existe
 * provedor de odds integrado ainda. Cobre os estados reais que uma casa de
 * apostas tem: pré-jogo, ao vivo, suspenso (odds bloqueadas), encerrado,
 * variação de odd, seleção (liga com "Bilhetes"), favoritos e "+mercados".
 */

type SportKey = "futebol" | "basquete" | "volei" | "tenis" | "esports";
type SportIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

const SPORTS: Array<{ key: SportKey; label: string; icon: SportIcon }> = [
  { key: "futebol", label: "Futebol", icon: BottomNavEsportesIcon },
  { key: "basquete", label: "Basquete", icon: SportBasketballIcon },
  { key: "volei", label: "Vôlei", icon: SportVoleiIcon },
  { key: "tenis", label: "Tênis", icon: SportTenisIcon },
  { key: "esports", label: "Esports", icon: SportEsportsIcon },
];

const FILTERS = ["Hoje", "Ao Vivo", "Amanhã", "Competições", "Favoritos"] as const;
type Filter = (typeof FILTERS)[number];

type MatchStatus = "upcoming" | "live" | "suspended" | "finished";

type MockOddsMatch = {
  id: string;
  dateLabel: string;
  competition: string;
  status: MatchStatus;
  liveMinute?: string;
  home: { flag: string; name: string; score?: number };
  away: { flag: string; name: string; score?: number };
  odds: { home: string; draw: string; away: string };
  favoritedDefault?: boolean;
  extraMarketsCount?: number;
};

// Exemplos ilustrativos — sem provedor de odds real integrado ainda.
const MOCK_MATCHES: MockOddsMatch[] = [
  {
    id: "m1",
    dateLabel: "01/07 · 13:00",
    competition: "Copa do Mundo",
    status: "upcoming",
    home: { flag: "🏴", name: "Inglaterra" },
    away: { flag: "🇨🇩", name: "RD Congo" },
    odds: { home: "1.33", draw: "3.80", away: "8.50" },
    extraMarketsCount: 42,
  },
  {
    id: "m2",
    dateLabel: "AO VIVO",
    competition: "Copa do Mundo",
    status: "live",
    liveMinute: "67'",
    home: { flag: "🇪🇸", name: "Espanha", score: 2 },
    away: { flag: "🇵🇹", name: "Portugal", score: 1 },
    odds: { home: "1.60", draw: "3.20", away: "6.75" },
    favoritedDefault: true,
    extraMarketsCount: 58,
  },
  {
    id: "m3",
    dateLabel: "AO VIVO",
    competition: "Brasileirão Série A",
    status: "suspended",
    liveMinute: "34'",
    home: { flag: "🇧🇷", name: "Time A", score: 0 },
    away: { flag: "🇧🇷", name: "Time B", score: 0 },
    odds: { home: "—", draw: "—", away: "—" },
  },
  {
    id: "m4",
    dateLabel: "Hoje · 10:00",
    competition: "Copa do Mundo",
    status: "finished",
    home: { flag: "🇧🇷", name: "Brasil", score: 3 },
    away: { flag: "🇳🇴", name: "Noruega", score: 1 },
    odds: { home: "1.33", draw: "3.80", away: "8.50" },
  },
  {
    id: "m5",
    dateLabel: "Amanhã · 16:00",
    competition: "Copa do Mundo",
    status: "upcoming",
    home: { flag: "🇦🇷", name: "Argentina" },
    away: { flag: "🇫🇷", name: "França" },
    odds: { home: "2.10", draw: "3.40", away: "3.15" },
    extraMarketsCount: 61,
  },
];

function statusMeta(status: MatchStatus): { label: string; className: string } {
  switch (status) {
    case "live":
      return { label: "Ao vivo", className: "bg-red-500/15 text-red-300" };
    case "suspended":
      return { label: "Suspenso", className: "bg-amber-400/15 text-amber-300" };
    case "finished":
      return { label: "Encerrado", className: "bg-white/8 text-white/50" };
    default:
      return { label: "Pré-jogo", className: "bg-white/6 text-white/45" };
  }
}

function OddBox({
  label,
  value,
  disabled,
  selected,
  onClick,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  if (disabled) {
    return (
      <div className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-white/6 bg-white/[0.02] px-3 py-2.5 text-white/25">
        <Lock className="size-3.5" strokeWidth={2} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-between rounded-[8px] border px-3 py-2 transition ${
        selected
          ? "border-primary bg-primary text-[#0E141B]"
          : "border-white/8 bg-white/[0.03] hover:border-white/20"
      }`}
    >
      <span className={`text-[11px] font-bold uppercase ${selected ? "text-[#0E141B]/70" : "text-white/40"}`}>
        {label}
      </span>
      <span className={`text-[14px] font-black tabular-nums ${selected ? "text-[#0E141B]" : "text-primary"}`}>
        {value}
      </span>
    </button>
  );
}

function MatchRow({
  match,
  favorited,
  onToggleFavorite,
  selectedKey,
  onSelect,
}: {
  match: MockOddsMatch;
  favorited: boolean;
  onToggleFavorite: () => void;
  selectedKey: string | null;
  onSelect: (market: "home" | "draw" | "away") => void;
}) {
  const meta = statusMeta(match.status);
  const marketsAvailable = match.status === "upcoming" || match.status === "live";
  const suspended = match.status === "suspended";
  const finished = match.status === "finished";

  return (
    <article className="rounded-[14px] border border-white/8 bg-[#0d0d0d] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-white/40">
          <span className={`shrink-0 rounded-[5px] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${meta.className}`}>
            {match.status === "live" ? (
              <span className="inline-flex items-center gap-1">
                <Radio className="size-2.5 animate-pulse" strokeWidth={2.5} />
                {meta.label}
              </span>
            ) : (
              meta.label
            )}
          </span>
          <span className="truncate">
            {match.status === "live" && match.liveMinute ? match.liveMinute : match.dateLabel} · {match.competition}
          </span>
        </p>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label="Favoritar"
          className="shrink-0 text-white/25 transition hover:text-white/50"
        >
          <Star className={`size-4 ${favorited ? "fill-primary text-primary" : ""}`} strokeWidth={2} />
        </button>
      </div>

      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[16px] leading-none">{match.home.flag}</span>
            <span className="text-[13px] font-bold text-white">{match.home.name}</span>
          </div>
          {match.home.score != null ? (
            <span className="text-[14px] font-black tabular-nums text-white">{match.home.score}</span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[16px] leading-none">{match.away.flag}</span>
            <span className="text-[13px] font-bold text-white">{match.away.name}</span>
          </div>
          {match.away.score != null ? (
            <span className="text-[14px] font-black tabular-nums text-white">{match.away.score}</span>
          ) : null}
        </div>
      </div>

      {finished ? (
        <p className="mt-3 rounded-[8px] border border-white/6 bg-white/[0.02] px-3 py-2 text-center text-[11px] font-semibold text-white/35">
          Mercado encerrado
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <OddBox
            label="1"
            value={match.odds.home}
            disabled={suspended}
            selected={selectedKey === "home"}
            onClick={marketsAvailable ? () => onSelect("home") : undefined}
          />
          <OddBox
            label="x"
            value={match.odds.draw}
            disabled={suspended}
            selected={selectedKey === "draw"}
            onClick={marketsAvailable ? () => onSelect("draw") : undefined}
          />
          <OddBox
            label="2"
            value={match.odds.away}
            disabled={suspended}
            selected={selectedKey === "away"}
            onClick={marketsAvailable ? () => onSelect("away") : undefined}
          />
        </div>
      )}

      {match.extraMarketsCount ? (
        <p className="mt-2.5 text-center text-[11px] font-semibold text-white/30">
          + {match.extraMarketsCount} mercados
        </p>
      ) : null}
    </article>
  );
}

const MARKET_LABELS: Record<"home" | "draw" | "away", string> = {
  home: "Vitória casa (1)",
  draw: "Empate (x)",
  away: "Vitória fora (2)",
};

type SlipItem = {
  matchId: string;
  matchLabel: string;
  marketLabel: string;
  oddValue: number;
};

/** Modal do bilhete — soma de odds (combinada) + valor de aposta simulado. Mockup, sem checkout real. */
function BetSlipModal({
  items,
  onRemove,
  onClose,
}: {
  items: SlipItem[];
  onRemove: (matchId: string) => void;
  onClose: () => void;
}) {
  const [stakeStr, setStakeStr] = useState("20,00");
  const combinedOdds = items.reduce((acc, it) => acc * it.oddValue, 1);
  const stake = Number(stakeStr.replace(",", ".")) || 0;
  const potentialReturn = stake * combinedOdds;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-[440px] overflow-hidden rounded-t-3xl border border-white/10 sm:rounded-3xl"
        style={{ background: "#0c0c0c" }}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <p className="flex items-center gap-2 text-[15px] font-black text-white">
            <Ticket className="size-4 text-primary" strokeWidth={2.25} />
            Seu bilhete
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-white/40">Nenhuma seleção no bilhete.</p>
          ) : (
            <ul className="space-y-2.5">
              {items.map((it) => (
                <li
                  key={it.matchId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-white">{it.matchLabel}</p>
                    <p className="text-[11px] text-white/40">{it.marketLabel}</p>
                  </div>
                  <span className="shrink-0 text-[14px] font-black tabular-nums text-primary">
                    {it.oddValue.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(it.matchId)}
                    aria-label="Remover seleção"
                    className="shrink-0 text-white/30 transition hover:text-red-400"
                  >
                    <X className="size-4" strokeWidth={2.25} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <div className="border-t border-white/8 px-5 py-4">
            <div className="flex items-center justify-between text-[12px] text-white/50">
              <span>Odd combinada</span>
              <span className="font-black text-white">{combinedOdds.toFixed(2)}</span>
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-[12px] font-semibold text-white/50">Valor da aposta (R$)</label>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5">
                <span className="text-[15px] font-bold text-white/40">R$</span>
                <input
                  inputMode="decimal"
                  value={stakeStr}
                  onChange={(e) => setStakeStr(e.target.value.replace(/[^\d,]/g, ""))}
                  className="h-12 w-full bg-transparent text-[16px] font-bold text-white outline-none"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3">
              <span className="text-[12px] font-semibold text-white/60">Retorno potencial</span>
              <span className="text-[16px] font-black text-primary">
                {potentialReturn.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>

            <button
              type="button"
              disabled
              className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[15px] font-black uppercase tracking-wide text-[#0E141B] opacity-50"
            >
              Apostar — em breve
            </button>
            <p className="mt-2 text-center text-[11px] text-white/30">
              Mockup — apostas com odds ainda não estão disponíveis para valer.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function EsportesPage() {
  const [sport, setSport] = useState<SportKey>("futebol");
  const [filter, setFilter] = useState<Filter>("Hoje");
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(MOCK_MATCHES.filter((m) => m.favoritedDefault).map((m) => m.id))
  );
  const [selections, setSelections] = useState<Record<string, "home" | "draw" | "away">>({});
  const [betSlipOpen, setBetSlipOpen] = useState(false);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectMarket = (matchId: string, market: "home" | "draw" | "away") => {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[matchId] === market) delete next[matchId];
      else next[matchId] = market;
      return next;
    });
  };

  const visibleMatches = useMemo(() => {
    if (filter === "Ao Vivo") return MOCK_MATCHES.filter((m) => m.status === "live" || m.status === "suspended");
    if (filter === "Favoritos") return MOCK_MATCHES.filter((m) => favorites.has(m.id));
    return MOCK_MATCHES;
  }, [filter, favorites]);

  const liveCount = MOCK_MATCHES.filter((m) => m.status === "live" || m.status === "suspended").length;
  const selectionCount = Object.keys(selections).length;

  const slipItems: SlipItem[] = useMemo(() => {
    return Object.entries(selections).flatMap(([matchId, market]) => {
      const match = MOCK_MATCHES.find((m) => m.id === matchId);
      if (!match) return [];
      const oddValue = Number(match.odds[market]);
      if (!Number.isFinite(oddValue)) return [];
      return [
        {
          matchId,
          matchLabel: `${match.home.name} x ${match.away.name}`,
          marketLabel: MARKET_LABELS[market],
          oddValue,
        },
      ];
    });
  }, [selections]);

  const removeSelection = (matchId: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 pb-28 sm:px-6 md:max-w-2xl md:py-8">
      <h1 className="mb-5 text-[26px] font-black tracking-tight text-white md:text-3xl">Esportes</h1>

      {/* Modalidades */}
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SPORTS.map((s) => {
          const Icon = s.icon;
          const active = sport === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSport(s.key)}
              className={`flex shrink-0 flex-col items-center gap-1.5 rounded-[12px] border px-4 py-2.5 transition ${
                active ? "border-primary/40 bg-primary/10" : "border-white/8 bg-white/[0.03]"
              }`}
            >
              <Icon className={`size-5 ${active ? "text-primary" : "text-white/50"}`} strokeWidth={1.8} />
              <span className={`text-[10px] font-bold uppercase ${active ? "text-primary" : "text-white/50"}`}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase transition ${
                active ? "bg-primary text-[#0E141B]" : "border border-white/10 bg-white/[0.04] text-white/55"
              }`}
            >
              {f}
              {f === "Ao Vivo" && liveCount > 0 ? (
                <span
                  className={`flex size-4 items-center justify-center rounded-full text-[9px] font-black ${
                    active ? "bg-[#0E141B] text-primary" : "bg-primary text-[#0E141B]"
                  }`}
                >
                  {liveCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Lista de jogos */}
      {sport === "futebol" ? (
        visibleMatches.length > 0 ? (
          <div className="space-y-2.5">
            {visibleMatches.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                favorited={favorites.has(m.id)}
                onToggleFavorite={() => toggleFavorite(m.id)}
                selectedKey={selections[m.id] ?? null}
                onSelect={(market) => selectMarket(m.id, market)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[16px] border border-white/8 bg-[#0d0d0d] py-14 text-center">
            <p className="text-[14px] font-bold text-white">Nenhum jogo aqui</p>
            <p className="mt-1.5 max-w-[220px] text-[12px] text-white/40">
              {filter === "Favoritos" ? "Favorite jogos tocando na estrela do card." : "Tente outro filtro."}
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[16px] border border-white/8 bg-[#0d0d0d] py-14 text-center">
          <p className="text-[14px] font-bold text-white">
            {SPORTS.find((s) => s.key === sport)?.label} em breve
          </p>
          <p className="mt-1.5 max-w-[220px] text-[12px] text-white/40">
            Essa modalidade ainda não tem jogos disponíveis.
          </p>
        </div>
      )}

      <p className="mt-5 text-center text-[10px] text-white/25">
        Odds meramente ilustrativas — não representam apostas reais.
      </p>

      {/* Mini "bilhete" flutuante — mockup de seleção, sem checkout real ainda */}
      {selectionCount > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[80] mx-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-[14px] border border-primary/30 bg-[#0E141B] px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] sm:px-6 md:max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[12px] font-black text-[#0E141B]">
              {selectionCount}
            </span>
            <span className="text-[13px] font-bold text-white">
              {selectionCount === 1 ? "seleção no bilhete" : "seleções no bilhete"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelections({})}
              aria-label="Limpar seleções"
              className="flex size-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => setBetSlipOpen(true)}
              className="flex h-9 items-center justify-center rounded-[10px] bg-primary px-4 text-[12px] font-black uppercase tracking-wide text-[#0E141B]"
            >
              Ver bilhete
            </button>
          </div>
        </div>
      ) : null}

      {betSlipOpen ? (
        <BetSlipModal items={slipItems} onRemove={removeSelection} onClose={() => setBetSlipOpen(false)} />
      ) : null}
    </div>
  );
}
