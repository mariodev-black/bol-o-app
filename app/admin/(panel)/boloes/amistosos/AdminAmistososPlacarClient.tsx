"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { adminStatGridClass } from "@/app/admin/_components/admin-layout";
import type { AmistososAdminMatchRow } from "@/lib/football/amistosos-friendlies-persistence";

export function AdminAmistososPlacarClient({
  initialMatches,
}: {
  initialMatches: AmistososAdminMatchRow[];
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async (matchId: number, casa: number, visitante: number) => {
    setSavingId(matchId);
    setError(null);
    try {
      const r = await fetch("/api/admin/amistosos-matches", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          matchId,
          resultCasa: casa,
          resultVisitante: visitante,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        matches?: AmistososAdminMatchRow[];
        error?: string;
      };
      if (!r.ok || !data.ok || !data.matches) {
        setError(data.error ?? "Não foi possível salvar o placar.");
        return;
      }
      setMatches(data.matches);
    } catch {
      setError("Erro de rede ao salvar placar.");
    } finally {
      setSavingId(null);
    }
  }, []);

  const finalized = matches.filter(
    (m) => m.resultCasa != null && m.resultVisitante != null,
  ).length;

  return (
    <div className="space-y-5">
      <div className={adminStatGridClass}>
        <div className="rounded-xl border border-white/8 bg-[#111] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Jogos do bolão</p>
          <p className="mt-1 text-[22px] font-black text-white">{matches.length}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-[#111] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">Com placar</p>
          <p className="mt-1 text-[22px] font-black text-primary">{finalized}</p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
          {error}
        </p>
      ) : null}

      <p className="text-[12px] text-white/55">
        Sem fluxo ao vivo: ao salvar o placar, a pontuação dos palpites é recalculada automaticamente.
      </p>

      <ul className="space-y-3">
        {matches.map((m) => (
          <MatchPlacarRow
            key={m.matchId}
            match={m}
            saving={savingId === m.matchId}
            onSave={handleSave}
          />
        ))}
      </ul>
    </div>
  );
}

function MatchPlacarRow({
  match,
  saving,
  onSave,
}: {
  match: AmistososAdminMatchRow;
  saving: boolean;
  onSave: (matchId: number, casa: number, visitante: number) => void;
}) {
  const [casa, setCasa] = useState(String(match.resultCasa ?? 0));
  const [visitante, setVisitante] = useState(String(match.resultVisitante ?? 0));

  return (
    <li className="rounded-xl border border-white/10 bg-[#111] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <TeamChip name={match.homeName} logo={match.homeLogo} />
        <span className="text-[12px] font-bold text-white/40">x</span>
        <TeamChip name={match.awayName} logo={match.awayLogo} />
        <span className="ml-auto text-[11px] font-medium text-white/45">
          {match.dateBr} · {match.hourBr}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-white/45">Casa</span>
          <input
            type="number"
            min={0}
            max={99}
            value={casa}
            onChange={(e) => setCasa(e.target.value)}
            className="w-16 rounded-lg border border-white/12 bg-black/40 px-2 py-2 text-center text-[15px] font-bold text-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-white/45">Visitante</span>
          <input
            type="number"
            min={0}
            max={99}
            value={visitante}
            onChange={(e) => setVisitante(e.target.value)}
            className="w-16 rounded-lg border border-white/12 bg-black/40 px-2 py-2 text-center text-[15px] font-bold text-white"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(match.matchId, Number(casa), Number(visitante))}
          className="rounded-full bg-primary px-4 py-2 text-[12px] font-black uppercase text-[#0E141B] disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar placar"}
        </button>
        {match.resultCasa != null ? (
          <span className="text-[11px] font-medium text-primary">
            Atual: {match.resultCasa} x {match.resultVisitante}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function TeamChip({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {logo ? (
        <Image src={logo} alt="" width={28} height={28} className="size-7 object-contain" unoptimized />
      ) : (
        <span className="flex size-7 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-white/70">
          {name.slice(0, 3).toUpperCase()}
        </span>
      )}
      <span className="text-[13px] font-bold text-white">{name}</span>
    </div>
  );
}
