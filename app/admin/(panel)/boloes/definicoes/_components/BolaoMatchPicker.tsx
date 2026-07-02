"use client";

import type { AdminMatchPickerItem } from "@/lib/boloes/definitions/types";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  Minus,
  RefreshCw,
  Search,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Props = {
  competitionIds: number[];
  competitionLabel?: string;
  selectedMatchIds: number[];
  onChange: (matchIds: number[]) => void;
};

type FilterMode = "all" | "days" | "rounds";

const matchesCache = new Map<string, AdminMatchPickerItem[]>();

function competitionKey(ids: number[]): string {
  return ids.join(",");
}

function TeamShield({
  logo,
  sigla,
  side,
}: {
  logo: string | null;
  sigla: string;
  side: "home" | "away";
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(logo) && !failed;

  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-[#111] ${
        side === "home" ? "border-white/10" : "border-white/8"
      }`}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo!}
          alt=""
          className="size-full object-contain p-0.5"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[9px] font-black tracking-tight text-white/55">{sigla}</span>
      )}
    </span>
  );
}

function brDateSortKey(dateBR: string): string {
  const [d, m, y] = dateBR.split("/");
  if (!d || !m || !y) return dateBR;
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function formatDateLabel(dateBR: string): string {
  const [d, m, y] = dateBR.split("/").map(Number);
  if (!d || !m || !y) return dateBR;
  const dt = new Date(y, m - 1, d);
  const wd = dt.toLocaleDateString("pt-BR", { weekday: "short" });
  return `${wd} · ${dateBR}`;
}

function selectionState(
  ids: number[],
  selected: Set<number>,
): "none" | "partial" | "all" {
  if (ids.length === 0) return "none";
  const hit = ids.filter((id) => selected.has(id)).length;
  if (hit === 0) return "none";
  if (hit === ids.length) return "all";
  return "partial";
}

function TriCheckbox({ state }: { state: "none" | "partial" | "all" }) {
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded border transition ${
        state === "all"
          ? "border-primary bg-primary text-[#0a0a0a]"
          : state === "partial"
            ? "border-primary/60 bg-primary/20 text-primary"
            : "border-white/20 bg-transparent"
      }`}
    >
      {state === "all" ? (
        <Check className="size-3" strokeWidth={3} />
      ) : state === "partial" ? (
        <Minus className="size-3" strokeWidth={3} />
      ) : null}
    </span>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
        active
          ? "bg-white text-[#0a0a0a]"
          : "text-white/45 hover:bg-white/5 hover:text-white/70"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MatchRow({
  match,
  checked,
  onToggle,
  compact,
}: {
  match: AdminMatchPickerItem;
  checked: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition ${
        checked
          ? "border-primary/45 bg-primary/10 ring-1 ring-primary/20"
          : "border-white/6 bg-[#0a0a0a] hover:border-white/14 hover:bg-[#0e0e0e]"
      } ${compact ? "py-2" : ""}`}
    >
      <TriCheckbox state={checked ? "all" : "none"} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TeamShield logo={match.homeLogo} sigla={match.homeSigla} side="home" />
        <span className="text-[13px] font-black tracking-tight text-white">{match.homeSigla}</span>
        <span className="text-[11px] font-medium text-white/30">×</span>
        <span className="text-[13px] font-black tracking-tight text-white">{match.awaySigla}</span>
        <TeamShield logo={match.awayLogo} sigla={match.awaySigla} side="away" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="ml-auto text-[11px] font-bold tabular-nums text-primary/90">
              {match.hour}
            </span>
          </div>
        {!compact ? (
          <p className="mt-0.5 truncate text-[11px] text-white/40">
            {match.homeName} × {match.awayName}
          </p>
        ) : null}
        {match.rodada ? (
          <p className="mt-0.5 text-[10px] text-white/28">{match.rodada}ª rodada</p>
        ) : null}
        </div>
      </div>
    </button>
  );
}

export function BolaoMatchPicker({
  competitionIds,
  competitionLabel,
  selectedMatchIds,
  onChange,
}: Props) {
  const [matches, setMatches] = useState<AdminMatchPickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("days");
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [activeRounds, setActiveRounds] = useState<number[]>([]);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const loadedKeyRef = useRef<string | null>(null);

  const cacheKey = useMemo(() => competitionKey(competitionIds), [competitionIds]);

  const load = useCallback(
    async (force = false) => {
      if (competitionIds.length === 0) {
        setMatches([]);
        loadedKeyRef.current = null;
        return;
      }

      const cached = matchesCache.get(cacheKey);
      if (!force && cached) {
        setMatches(cached);
        setLoading(false);
        setError(null);
        loadedKeyRef.current = cacheKey;
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          competitionIds: cacheKey,
          limit: "500",
        });
        const r = await fetch(`/api/admin/boloes/definitions/matches?${params}`, {
          credentials: "include",
        });
        const d = (await r.json()) as { matches?: AdminMatchPickerItem[]; error?: string };
        if (!r.ok) throw new Error(d.error ?? "Falha ao carregar jogos");
        const next = d.matches ?? [];
        matchesCache.set(cacheKey, next);
        setMatches(next);
        loadedKeyRef.current = cacheKey;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar jogos");
        setMatches([]);
      } finally {
        setLoading(false);
      }
    },
    [cacheKey, competitionIds.length],
  );

  useEffect(() => {
    if (loadedKeyRef.current === cacheKey) return;
    void load();
  }, [cacheKey, load]);

  useEffect(() => {
    if (loadedKeyRef.current !== cacheKey) {
      setActiveDays([]);
      setActiveRounds([]);
      setSearch("");
    }
  }, [cacheKey]);

  const selected = useMemo(() => new Set(selectedMatchIds), [selectedMatchIds]);

  const daysMeta = useMemo(() => {
    const map = new Map<string, AdminMatchPickerItem[]>();
    for (const m of matches) {
      const key = m.dateBR || "Sem data";
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => brDateSortKey(a).localeCompare(brDateSortKey(b)))
      .map(([date, items]) => ({
        date,
        label: formatDateLabel(date),
        items,
        ids: items.map((i) => i.matchId),
      }));
  }, [matches]);

  const roundsMeta = useMemo(() => {
    const map = new Map<number, AdminMatchPickerItem[]>();
    for (const m of matches) {
      if (m.rodada == null || m.rodada <= 0) continue;
      const list = map.get(m.rodada) ?? [];
      list.push(m);
      map.set(m.rodada, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([round, items]) => ({
        round,
        label: `${round}ª rodada`,
        items,
        ids: items.map((i) => i.matchId),
      }));
  }, [matches]);

  const scopeMatches = useMemo(() => {
    let list = matches;
    if (filterMode === "days" && activeDays.length > 0) {
      const set = new Set(activeDays);
      list = list.filter((m) => set.has(m.dateBR));
    }
    if (filterMode === "rounds" && activeRounds.length > 0) {
      const set = new Set(activeRounds);
      list = list.filter((m) => m.rodada != null && set.has(m.rodada));
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.homeName.toLowerCase().includes(q) ||
        m.awayName.toLowerCase().includes(q) ||
        m.homeSigla.toLowerCase().includes(q) ||
        m.awaySigla.toLowerCase().includes(q) ||
        m.dateBR.includes(q),
    );
  }, [matches, filterMode, activeDays, activeRounds, search]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, AdminMatchPickerItem[]>();
    for (const m of scopeMatches) {
      const key = m.dateBR || "Sem data";
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) =>
      brDateSortKey(a).localeCompare(brDateSortKey(b)),
    );
  }, [scopeMatches]);

  function applySelection(next: Set<number>) {
    onChange([...next].sort((a, b) => a - b));
  }

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    applySelection(next);
  }

  function toggleIds(ids: number[], force?: boolean) {
    const next = new Set(selected);
    const state = selectionState(ids, selected);
    const selectAll = force ?? state !== "all";
    if (selectAll) ids.forEach((id) => next.add(id));
    else ids.forEach((id) => next.delete(id));
    applySelection(next);
  }

  function toggleDayFilter(date: string) {
    setActiveDays((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date],
    );
  }

  function toggleRoundFilter(round: number) {
    setActiveRounds((prev) =>
      prev.includes(round) ? prev.filter((r) => r !== round) : [...prev, round],
    );
  }

  function clearFilters() {
    setActiveDays([]);
    setActiveRounds([]);
    setSearch("");
  }

  if (competitionIds.length === 0) {
    return (
      <p className="text-[13px] text-white/40">Selecione ao menos um campeonato.</p>
    );
  }

  const scopeIds = scopeMatches.map((m) => m.matchId);
  const scopeSelection = selectionState(scopeIds, selected);

  return (
    <div className="space-y-4">
      {/* Stats + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-white/6 bg-[#080808] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-white">
            {selectedMatchIds.length}{" "}
            <span className="font-medium text-white/45">de {matches.length} selecionados</span>
          </p>
          {competitionLabel ? (
            <p className="truncate text-[11px] text-white/35">{competitionLabel}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || scopeIds.length === 0}
            onClick={() => toggleIds(scopeIds, scopeSelection !== "all")}
            className="rounded-[8px] border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/60 hover:bg-white/5 disabled:opacity-40"
          >
            {scopeSelection === "all" ? "Desmarcar filtro" : "Marcar filtro"}
          </button>
          <button
            type="button"
            disabled={selectedMatchIds.length === 0}
            onClick={() => applySelection(new Set())}
            className="rounded-[8px] border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/60 hover:bg-white/5 disabled:opacity-40"
          >
            Limpar tudo
          </button>
          <button
            type="button"
            onClick={() => void load(true)}
            className="inline-flex items-center gap-1 rounded-[8px] border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/60 hover:bg-white/5"
          >
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex rounded-[12px] border border-white/8 bg-[#0a0a0a] p-1">
        <ModeTab
          active={filterMode === "days"}
          onClick={() => {
            setFilterMode("days");
            setActiveRounds([]);
          }}
          icon={<CalendarDays className="size-3.5" />}
          label="Por dia"
        />
        <ModeTab
          active={filterMode === "rounds"}
          onClick={() => {
            setFilterMode("rounds");
            setActiveDays([]);
          }}
          icon={<Trophy className="size-3.5" />}
          label="Por rodada"
        />
        <ModeTab
          active={filterMode === "all"}
          onClick={() => {
            setFilterMode("all");
            setActiveDays([]);
            setActiveRounds([]);
          }}
          icon={<Layers className="size-3.5" />}
          label="Lista completa"
        />
      </div>

      {/* Day filters */}
      {filterMode === "days" && daysMeta.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">
              Dias {activeDays.length > 0 ? `(${activeDays.length} filtro)` : "— toque para filtrar"}
            </p>
            {activeDays.length > 0 ? (
              <button
                type="button"
                onClick={() => setActiveDays([])}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Ver todos os dias
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {daysMeta.map((day) => {
              const sel = selectionState(day.ids, selected);
              const filtered = activeDays.includes(day.date);
              const hasFilter = activeDays.length > 0;
              return (
                <div
                  key={day.date}
                  className={`flex shrink-0 flex-col rounded-[12px] border transition ${
                    hasFilter && filtered
                      ? "border-primary/40 bg-primary/5"
                      : hasFilter && !filtered
                        ? "border-white/5 bg-[#0a0a0a] opacity-45"
                        : "border-white/8 bg-[#0a0a0a]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleDayFilter(day.date)}
                    className="px-3 pt-2.5 text-left"
                    title="Filtrar lista por este dia"
                  >
                    <p className="whitespace-nowrap text-[12px] font-bold text-white">
                      {day.label}
                    </p>
                    <p className="text-[10px] text-white/40">
                      {day.items.length} jogo(s)
                      {sel !== "none" ? (
                        <span className="text-primary"> · {sel === "all" ? "todos ✓" : "parcial"}</span>
                      ) : null}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleIds(day.ids)}
                    className="mt-1 border-t border-white/6 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50 hover:bg-white/5 hover:text-primary"
                  >
                    {sel === "all" ? "Desmarcar dia" : "Marcar dia inteiro"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Round filters */}
      {filterMode === "rounds" && roundsMeta.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">
              Rodadas
              {activeRounds.length > 0 ? ` (${activeRounds.length} filtro)` : ""}
            </p>
            {activeRounds.length > 0 ? (
              <button
                type="button"
                onClick={() => setActiveRounds([])}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Ver todas
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {roundsMeta.map((round) => {
              const sel = selectionState(round.ids, selected);
              const filtered = activeRounds.includes(round.round);
              const hasFilter = activeRounds.length > 0;
              return (
                <div
                  key={round.round}
                  className={`overflow-hidden rounded-[10px] border ${
                    hasFilter && filtered
                      ? "border-primary/40 bg-primary/5"
                      : hasFilter && !filtered
                        ? "border-white/5 opacity-45"
                        : "border-white/8 bg-[#0a0a0a]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleRoundFilter(round.round)}
                    className="px-3 py-2 text-left"
                  >
                    <p className="text-[12px] font-bold text-white">{round.label}</p>
                    <p className="text-[10px] text-white/40">
                      {round.items.length} jogo(s)
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleIds(round.ids)}
                    className="w-full border-t border-white/6 px-3 py-1 text-[10px] font-bold uppercase text-white/45 hover:bg-white/5 hover:text-primary"
                  >
                    {sel === "all" ? "Desmarcar" : "Marcar rodada"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {filterMode === "rounds" && roundsMeta.length === 0 && !loading ? (
        <p className="rounded-[10px] border border-amber-400/20 bg-amber-950/20 px-3 py-2 text-[12px] text-amber-200/80">
          Sem rodadas cadastradas — use o modo <strong>Por dia</strong> ou <strong>Lista completa</strong>.
        </p>
      ) : null}

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar time, sigla ou data…"
          className="w-full rounded-[10px] border border-white/8 bg-[#080808] py-2.5 pl-9 pr-3 text-[13px] text-white outline-none focus:border-white/20"
        />
        {(search || activeDays.length || activeRounds.length) && filterMode !== "all" ? (
          <button
            type="button"
            onClick={clearFilters}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-primary"
          >
            Limpar
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-white/40">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-[13px]">Carregando jogos…</span>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-[10px] border border-red-400/20 bg-red-950/30 px-3 py-2 text-[13px] text-red-300">
          {error}
        </p>
      ) : null}

      {/* Match list */}
      {!loading && !error ? (
        <div className="max-h-[460px] overflow-y-auto rounded-[14px] border border-white/6 bg-[#060606] p-2">
          {filterMode === "all" ? (
            <div className="space-y-2">
              {groupedByDay.map(([date, items]) => {
                const ids = items.map((i) => i.matchId);
                const sel = selectionState(ids, selected);
                const collapsed = collapsedDays.has(date);
                return (
                  <div key={date} className="overflow-hidden rounded-[12px] border border-white/6">
                    <div className="flex items-center gap-2 bg-[#0e0e0e] px-2 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedDays((prev) => {
                            const next = new Set(prev);
                            if (next.has(date)) next.delete(date);
                            else next.add(date);
                            return next;
                          })
                        }
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        {collapsed ? (
                          <ChevronRight className="size-4 shrink-0 text-white/40" />
                        ) : (
                          <ChevronDown className="size-4 shrink-0 text-white/40" />
                        )}
                        <span className="truncate text-[12px] font-bold text-white">
                          {formatDateLabel(date)}
                        </span>
                        <span className="text-[10px] text-white/35">({items.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleIds(ids)}
                        className="shrink-0 rounded-[8px] border border-white/10 px-2 py-1 text-[10px] font-bold text-white/50 hover:text-primary"
                      >
                        {sel === "all" ? "Desmarcar" : "Marcar dia"}
                      </button>
                    </div>
                    {!collapsed ? (
                      <div className="grid gap-1.5 p-2 sm:grid-cols-2">
                        {items.map((m) => (
                          <MatchRow
                            key={m.matchId}
                            match={m}
                            checked={selected.has(m.matchId)}
                            onToggle={() => toggle(m.matchId)}
                            compact
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {groupedByDay.map(([date, items]) => (
                <div key={date}>
                  <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 bg-[#060606]/95 py-1.5 backdrop-blur-sm">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
                      {formatDateLabel(date)}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleIds(items.map((i) => i.matchId))}
                      className="text-[10px] font-bold text-primary/80 hover:text-primary"
                    >
                      {selectionState(
                        items.map((i) => i.matchId),
                        selected,
                      ) === "all"
                        ? "Desmarcar"
                        : "Marcar todos"}
                    </button>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {items.map((m) => (
                      <MatchRow
                        key={m.matchId}
                        match={m}
                        checked={selected.has(m.matchId)}
                        onToggle={() => toggle(m.matchId)}
                        compact
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {scopeMatches.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-white/35">
              {matches.length === 0
                ? "Nenhum jogo no cache. Sincronize os jogos no admin."
                : "Nenhum jogo para os filtros atuais."}
            </p>
          ) : null}
        </div>
      ) : null}

      {filterMode === "days" && activeDays.length > 1 ? (
        <p className="text-[11px] text-white/35">
          Exibindo {activeDays.length} dias selecionados — combine dias diferentes no mesmo bolão.
        </p>
      ) : null}
    </div>
  );
}
