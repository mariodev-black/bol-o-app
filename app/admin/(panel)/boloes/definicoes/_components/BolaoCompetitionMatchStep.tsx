"use client";

import type { AdminCompetitionOption } from "@/lib/boloes/definitions/types";
import { BolaoMatchPicker } from "@/app/admin/(panel)/boloes/definicoes/_components/BolaoMatchPicker";
import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type MatchIdsByCompetition = Record<number, number[]>;

type Props = {
  competitions: AdminCompetitionOption[];
  competitionIds: number[];
  onCompetitionIdsChange: (ids: number[]) => void;
  matchIdsByCompetition: MatchIdsByCompetition;
  onMatchIdsByCompetitionChange: (next: MatchIdsByCompetition) => void;
};

function CompetitionRow({
  competition,
  selected,
  matchCount,
  onSelect,
}: {
  competition: AdminCompetitionOption;
  selected: boolean;
  matchCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-[12px] border px-4 py-3 text-left transition ${
        selected
          ? "border-primary/35 bg-primary/5"
          : "border-white/6 bg-[#0a0a0a] hover:border-white/12"
      }`}
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded border ${
          selected
            ? "border-primary bg-primary text-[#0a0a0a]"
            : "border-white/20 bg-transparent"
        }`}
      >
        {selected ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-white">
          {competition.displayName}
        </p>
        <p className="text-[11px] text-white/40">
          ID API-Futebol:{" "}
          <span className="font-mono font-bold text-primary">{competition.id}</span>
          {competition.currentRoundLabel
            ? ` · ${competition.currentRoundLabel}`
            : competition.currentRound
              ? ` · ${competition.currentRound}ª rodada`
              : ""}
        </p>
      </div>
      {matchCount > 0 ? (
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
          {matchCount} jogo(s)
        </span>
      ) : null}
    </button>
  );
}

function CompetitionMatchPickerPanel({
  competition,
  selectedMatchIds,
  onChange,
}: {
  competition: AdminCompetitionOption;
  selectedMatchIds: number[];
  onChange: (matchIds: number[]) => void;
}) {
  const competitionIds = useMemo(() => [competition.id], [competition.id]);

  return (
    <BolaoMatchPicker
      competitionIds={competitionIds}
      competitionLabel={`${competition.displayName} · ID ${competition.id}`}
      selectedMatchIds={selectedMatchIds}
      onChange={onChange}
    />
  );
}

export function BolaoCompetitionMatchStep({
  competitions,
  competitionIds,
  onCompetitionIdsChange,
  matchIdsByCompetition,
  onMatchIdsByCompetitionChange,
}: Props) {
  const selectedCompetitions = competitions.filter((c) => competitionIds.includes(c.id));
  const totalMatches = Object.values(matchIdsByCompetition).reduce(
    (sum, ids) => sum + ids.length,
    0,
  );

  const [focusedCompId, setFocusedCompId] = useState<number | null>(competitionIds[0] ?? null);

  useEffect(() => {
    if (focusedCompId != null && !competitionIds.includes(focusedCompId)) {
      setFocusedCompId(competitionIds[0] ?? null);
    } else if (focusedCompId == null && competitionIds[0] != null) {
      setFocusedCompId(competitionIds[0]);
    }
  }, [competitionIds, focusedCompId]);

  function toggleCompetition(id: number) {
    const set = new Set(competitionIds);
    if (set.has(id)) {
      set.delete(id);
      const next = [...set].sort((a, b) => a - b);
      onCompetitionIdsChange(next);
      const nextMatches = { ...matchIdsByCompetition };
      delete nextMatches[id];
      onMatchIdsByCompetitionChange(nextMatches);
      if (focusedCompId === id) {
        setFocusedCompId(next[0] ?? null);
      }
    } else {
      const next = [...set, id].sort((a, b) => a - b);
      onCompetitionIdsChange(next);
      setFocusedCompId(id);
    }
  }

  function setMatchesForComp(compId: number, matchIds: number[]) {
    onMatchIdsByCompetitionChange({
      ...matchIdsByCompetition,
      [compId]: matchIds,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[14px] font-bold text-white">Campeonatos (API-Futebol)</h3>
        <p className="mt-1 mb-3 text-[12px] text-white/40">
          Selecione os campeonatos pelo ID da API. Depois escolha os jogos de cada um.
        </p>
        <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
          {competitions.length === 0 ? (
            <p className="text-[13px] text-white/35">
              Nenhum campeonato sincronizado. Rode o sync de jogos no admin.
            </p>
          ) : (
            competitions.map((c) => (
              <CompetitionRow
                key={c.id}
                competition={c}
                selected={competitionIds.includes(c.id)}
                matchCount={matchIdsByCompetition[c.id]?.length ?? 0}
                onSelect={() => toggleCompetition(c.id)}
              />
            ))
          )}
        </div>
      </div>

      {selectedCompetitions.length > 0 ? (
        <div className="overflow-hidden rounded-[16px] border border-white/6 bg-[#0c0c0c]">
          <div className="border-b border-white/6 bg-[#0a0a0a] px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-bold text-white">Escolher jogos</h3>
                <p className="mt-1 text-[12px] text-white/40">
                  {totalMatches} jogo(s) · {selectedCompetitions.length} campeonato(s)
                </p>
              </div>
              {totalMatches > 0 ? (
                <span className="rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold text-primary">
                  {totalMatches} selecionado(s)
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
            {selectedCompetitions.map((c) => {
              const count = matchIdsByCompetition[c.id]?.length ?? 0;
              const active = focusedCompId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFocusedCompId(c.id)}
                  className={`rounded-[10px] border px-3 py-2 text-[12px] font-bold transition ${
                    active
                      ? "border-white/20 bg-[#1a1a1a] text-white"
                      : "border-white/6 bg-[#0a0a0a] text-white/45 hover:border-white/12"
                  }`}
                >
                  {c.displayName}
                  <span className="ml-1 font-mono text-[10px] text-white/40">#{c.id}</span>
                  {count > 0 ? (
                    <span className="ml-1.5 text-[10px] font-semibold text-primary">
                      ({count})
                    </span>
                  ) : null}
                </button>
              );
            })}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {selectedCompetitions.map((c) => {
              const active = focusedCompId === c.id;
              return (
                <div key={c.id} className={active ? undefined : "hidden"}>
                  <CompetitionMatchPickerPanel
                    competition={c}
                    selectedMatchIds={matchIdsByCompetition[c.id] ?? []}
                    onChange={(ids) => setMatchesForComp(c.id, ids)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-white/35">
          Selecione ao menos um campeonato acima para escolher os jogos.
        </p>
      )}
    </div>
  );
}
