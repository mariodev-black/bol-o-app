"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Search, Trophy } from "lucide-react";
import type { ArtilheiroOfficialResultRow } from "@/lib/artilheiros/types";
import type { ArtilheiroPickSlot } from "@/lib/artilheiros/config";
import { ARTILHEIRO_SLOT_LABELS } from "@/lib/artilheiros/config";
import { formatPosicao } from "@/lib/artilheiros/elencos-display";

type Team = {
  apiTeamId: number;
  nome: string;
  displayNome: string;
  codigo: string;
  logo: string;
  grupoLabel: string | null;
};

type Player = {
  apiPlayerId: number;
  apiTeamId: number;
  nome: string;
  foto: string;
  posicao: string;
  posicaoLabel: string;
  teamDisplayNome: string;
  numero: number | null;
};

type RankingRow = {
  ticketId: string;
  userName: string;
  position: number;
  totalPoints: number;
  picksCount: number;
};

export function AdminArtilheirosClient() {
  const [results, setResults] = useState<ArtilheiroOfficialResultRow[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [activeSlot, setActiveSlot] = useState<ArtilheiroPickSlot>(1);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamQuery, setTeamQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [goals, setGoals] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/artilheiros/results", { credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro ao carregar");
      setResults(j.results ?? []);
      setRanking(j.ranking ?? []);
      const g: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      for (const row of j.results ?? []) g[row.slot] = row.goals ?? 0;
      setGoals(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const url = teamQuery.trim()
        ? `/api/artilheiros/elencos?q=${encodeURIComponent(teamQuery.trim())}`
        : "/api/artilheiros/elencos";
      const r = await fetch(url);
      const j = await r.json();
      setTeams(j.teams ?? []);
    })();
  }, [teamQuery]);

  useEffect(() => {
    if (!selectedTeam) return;
    const params = new URLSearchParams({ teamId: String(selectedTeam.apiTeamId) });
    if (playerQuery.trim()) params.set("q", playerQuery.trim());
    void (async () => {
      const r = await fetch(`/api/artilheiros/elencos?${params}`);
      const j = await r.json();
      setPlayers(j.players ?? []);
    })();
  }, [selectedTeam, playerQuery]);

  async function saveSlot(player: Player) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/artilheiros/results", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot: activeSlot,
          apiPlayerId: player.apiPlayerId,
          apiTeamId: player.apiTeamId,
          goals: goals[activeSlot] ?? 0,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro ao salvar");
      setResults(j.results ?? []);
      setMessage(`${ARTILHEIRO_SLOT_LABELS[activeSlot]} salvo.`);
      setSelectedTeam(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function applyResults() {
    setApplying(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/artilheiros/results", {
        method: "POST",
        credentials: "include",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro ao aplicar");
      setResults(j.results ?? []);
      setRanking(j.ranking ?? []);
      setMessage(`Resultado aplicado — ${j.ticketsScored ?? 0} cotas pontuadas.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const applied = results.length === 3 && results.every((r) => r.appliedAt);

  return (
    <div className="space-y-8">
      {message ? (
        <p className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-[13px] text-primary">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
          {error}
        </p>
      ) : null}

      <section className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
        <h2 className="text-[15px] font-black text-white">Resultado oficial</h2>
        <p className="mt-1 text-[12px] text-white/45">
          Defina os 3 artilheiros e aplique para calcular o ranking.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {([1, 2, 3] as const).map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => {
                setActiveSlot(slot);
                setSelectedTeam(null);
              }}
              className={
                activeSlot === slot
                  ? "rounded-full border border-primary bg-primary/15 px-4 py-2 text-[11px] font-black uppercase text-primary"
                  : "rounded-full border border-white/10 px-4 py-2 text-[11px] font-black uppercase text-white/55"
              }
            >
              {ARTILHEIRO_SLOT_LABELS[slot]}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([1, 2, 3] as const).map((slot) => {
            const row = results.find((r) => r.slot === slot);
            return (
              <div key={slot} className="rounded-xl border border-white/8 bg-black/30 p-3">
                <p className="text-[10px] font-black uppercase text-white/40">
                  {ARTILHEIRO_SLOT_LABELS[slot]}
                </p>
                {row ? (
                  <div className="mt-2 flex items-center gap-2">
                    {row.playerPhoto ? (
                      <div className="relative size-10 overflow-hidden rounded-full">
                        <Image src={row.playerPhoto} alt="" fill className="object-cover" unoptimized />
                      </div>
                    ) : null}
                    <div>
                      <p className="text-[13px] font-bold">{row.playerName}</p>
                      <p className="text-[11px] text-white/45">{row.teamName}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] text-white/35">Não definido</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <label className="text-[11px] font-bold uppercase text-white/45">Gols ({ARTILHEIRO_SLOT_LABELS[activeSlot]})</label>
          <input
            type="number"
            min={0}
            value={goals[activeSlot] ?? 0}
            onChange={(e) =>
              setGoals((prev) => ({ ...prev, [activeSlot]: Math.max(0, Number(e.target.value) || 0) }))
            }
            className="mt-1 h-10 w-full max-w-[120px] rounded-lg border border-white/10 bg-black px-3 text-[14px]"
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
              <input
                value={teamQuery}
                onChange={(e) => setTeamQuery(e.target.value)}
                placeholder="Buscar seleção…"
                className="h-10 w-full rounded-lg border border-white/10 bg-black pl-10 pr-3 text-[13px]"
              />
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {teams.map((t) => (
                <li key={t.apiTeamId}>
                  <button
                    type="button"
                    onClick={() => setSelectedTeam(t)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                  >
                    <div className="relative size-7 shrink-0">
                      <Image src={t.logo} alt="" fill className="object-contain" unoptimized />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[13px]">{t.displayNome}</span>
                      {t.grupoLabel ? (
                        <span className="block text-[10px] text-white/40">{t.grupoLabel}</span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {selectedTeam ? (
            <div>
              <p className="mb-2 text-[12px] font-bold">{selectedTeam.displayNome}</p>
              <input
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
                placeholder="Buscar jogador…"
                className="mb-2 h-10 w-full rounded-lg border border-white/10 bg-black px-3 text-[13px]"
              />
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {players.map((p) => (
                  <li key={p.apiPlayerId}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveSlot(p)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5 disabled:opacity-50"
                    >
                      <div className="relative size-8 overflow-hidden rounded-full">
                        <Image src={p.foto} alt="" fill className="object-cover" unoptimized />
                      </div>
                      <span className="text-[13px]">
                        {p.nome}
                        <span className="block text-[10px] text-white/40">
                          {p.posicaoLabel}
                          {p.numero != null ? ` · #${p.numero}` : ""} · {p.teamDisplayNome}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          disabled={applying || results.length < 3}
          onClick={() => void applyResults()}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[12px] font-black uppercase text-black disabled:opacity-40"
        >
          {applying ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
          Aplicar resultado e calcular ranking
        </button>
        {applied ? (
          <p className="mt-2 text-[12px] text-primary">Resultado já aplicado.</p>
        ) : null}
      </section>

      <section className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
        <h2 className="text-[15px] font-black text-white">Ranking</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase text-white/40">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Usuário</th>
                <th className="py-2 pr-3">Pts</th>
                <th className="py-2">Palpites</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((row) => (
                <tr key={row.ticketId} className="border-t border-white/6">
                  <td className="py-2 pr-3 font-bold text-primary">{row.position}º</td>
                  <td className="py-2 pr-3">{row.userName}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.totalPoints}</td>
                  <td className="py-2 tabular-nums">{row.picksCount}/3</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
