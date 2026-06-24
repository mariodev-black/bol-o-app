"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { getAvatarPresetImage } from "@/lib/user/avatar-presets";
import type { PredictionBolaoType } from "@/lib/predictions";
import {
  isFinishedMatchStatus,
  isLiveOrInProgressMatchStatus,
} from "@/lib/palpites-match-open";

const CARD = "#101010";
const BORDER = "rgba(255,255,255,0.08)";
const PRIMARY = "#B1EB0B";

type PlayerPalpite = {
  userId: string;
  displayName: string;
  avatarIndex: number;
  avatarUploadFilename: string | null;
  matchId: number;
  homeName: string;
  homeSigla: string | null;
  homeLogo: string | null;
  awayName: string;
  awaySigla: string | null;
  awayLogo: string | null;
  dateBR: string | null;
  hour: string | null;
  status: string | null;
  resultCasa: number | null;
  resultVisitante: number | null;
  scoreCasa: number;
  scoreVisitante: number;
  submittedAtMs: number;
};

function sigla(name: string, fallback: string | null): string {
  const s = (fallback ?? "").trim();
  if (s) return s.toUpperCase().slice(0, 3);
  const clean = name.trim();
  if (!clean) return "—";
  return clean.slice(0, 3).toUpperCase();
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (!Number.isFinite(diff) || diff < 0) return "agora";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  return `há ${Math.floor(d / 7)} sem`;
}

type PalpitePhase = "live" | "finished" | "pending";

/**
 * Fase da partida para o badge. Um jogo AO VIVO já tem placar parcial
 * (ex.: 0×0), então NÃO pode ser tratado como "Deu X×Y" (final). Usamos o
 * `status` para distinguir andamento de encerrado.
 */
function matchPhase(p: PlayerPalpite): PalpitePhase {
  const status = p.status ?? "";
  const temPlacar = p.resultCasa != null && p.resultVisitante != null;
  if (isLiveOrInProgressMatchStatus(status)) return "live";
  if (isFinishedMatchStatus(status) && temPlacar) return "finished";
  // Sem status confiável: só considera final se houver placar e não estiver ao vivo.
  if (!status && temPlacar) return "finished";
  return "pending";
}

function Avatar({
  userId,
  avatarIndex,
  avatarUploadFilename,
}: {
  userId: string;
  avatarIndex: number;
  avatarUploadFilename: string | null;
}) {
  const cls =
    "relative size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15";
  if (avatarUploadFilename) {
    const src = `/api/public/avatar/${encodeURIComponent(userId)}?v=${encodeURIComponent(avatarUploadFilename)}`;
    return (
      <div className={cls}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="size-full object-cover" />
      </div>
    );
  }
  return (
    <div className={cls}>
      <Image src={getAvatarPresetImage(avatarIndex)} alt="" fill className="object-cover" sizes="36px" />
    </div>
  );
}

function TeamCrest({ logo, name }: { logo: string | null; name: string }) {
  if (!logo) {
    return <div className="size-6 shrink-0 rounded-full bg-white/10" aria-hidden />;
  }
  return (
    <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/90">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt={name} className="size-[18px] object-contain" />
    </div>
  );
}

function PalpiteCard({ p }: { p: PlayerPalpite }) {
  const phase = matchPhase(p);
  // "Cravou" só faz sentido com placar FINAL — nunca durante o jogo.
  const exact =
    phase === "finished" &&
    p.scoreCasa === p.resultCasa &&
    p.scoreVisitante === p.resultVisitante;
  return (
    <div
      className="rounded-2xl border px-3.5 py-3"
      style={{ background: CARD, borderColor: BORDER }}
    >
      <div className="mb-2.5 flex items-center gap-2.5">
        <Avatar
          userId={p.userId}
          avatarIndex={p.avatarIndex}
          avatarUploadFilename={p.avatarUploadFilename}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold leading-tight text-white">
            {p.displayName}
          </p>
          <p className="text-[11px] font-medium text-white/40">
            {relativeTime(p.submittedAtMs)}
          </p>
        </div>
        {phase === "live" ? (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
            style={{ background: "rgba(255,69,69,0.16)", color: "#ff6b6b" }}
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ff6b6b] opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[#ff6b6b]" />
            </span>
            {p.resultCasa != null && p.resultVisitante != null
              ? `Ao vivo ${p.resultCasa}×${p.resultVisitante}`
              : "Ao vivo"}
          </span>
        ) : phase === "finished" ? (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
            style={
              exact
                ? { background: "rgba(177,235,11,0.16)", color: PRIMARY }
                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }
            }
          >
            {exact ? "Cravou" : `Deu ${p.resultCasa}×${p.resultVisitante}`}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {/* Casa */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <span className="truncate text-[12px] font-bold text-white/80">
            {sigla(p.homeName, p.homeSigla)}
          </span>
          <TeamCrest logo={p.homeLogo} name={p.homeName} />
        </div>

        {/* Palpite */}
        <div
          className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1"
          style={{ background: "rgba(177,235,11,0.12)", border: "1px solid rgba(177,235,11,0.25)" }}
        >
          <span className="text-[16px] font-black tabular-nums" style={{ color: PRIMARY }}>
            {p.scoreCasa}
          </span>
          <span className="text-[12px] font-black text-white/35">×</span>
          <span className="text-[16px] font-black tabular-nums" style={{ color: PRIMARY }}>
            {p.scoreVisitante}
          </span>
        </div>

        {/* Visitante */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <TeamCrest logo={p.awayLogo} name={p.awayName} />
          <span className="truncate text-[12px] font-bold text-white/80">
            {sigla(p.awayName, p.awaySigla)}
          </span>
        </div>
      </div>

      {(p.dateBR || p.hour) && (
        <p className="mt-2 text-center text-[10px] font-medium text-white/30">
          {[p.dateBR, p.hour].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

export function PalpitesJogadoresTab({
  ticketId,
  bolaoType,
  extraChampionshipId,
}: {
  ticketId: string | null;
  bolaoType: PredictionBolaoType;
  extraChampionshipId?: number | null;
}) {
  const [palpites, setPalpites] = useState<PlayerPalpite[] | null>(null);
  const [error, setError] = useState(false);
  const tickRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 45_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (ticketId) {
      q.set("ticketId", ticketId);
    } else {
      q.set("bolaoType", bolaoType);
      if (bolaoType === "extra" && extraChampionshipId != null) {
        q.set("championshipId", String(extraChampionshipId));
      }
    }

    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(`/api/palpites/jogadores?${q.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await resp.json().catch(() => ({}))) as { palpites?: PlayerPalpite[] };
        if (cancelled) return;
        if (!resp.ok || !Array.isArray(data.palpites)) {
          setError(true);
          setPalpites([]);
          return;
        }
        setError(false);
        setPalpites(data.palpites);
      } catch {
        if (!cancelled) {
          setError(true);
          setPalpites([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticketId, bolaoType, extraChampionshipId, tick]);

  const loading = palpites === null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-primary" strokeWidth={2.4} aria-hidden />
        <h2 className="text-[13px] font-black uppercase tracking-[0.12em] text-white/80">
          Últimos palpites dos jogadores
        </h2>
      </div>

      {loading ? (
        <>
          <div className="h-[92px] animate-pulse rounded-2xl border" style={{ background: CARD, borderColor: BORDER }} />
          <div className="h-[92px] animate-pulse rounded-2xl border" style={{ background: CARD, borderColor: BORDER }} />
          <div className="h-[92px] animate-pulse rounded-2xl border" style={{ background: CARD, borderColor: BORDER }} />
        </>
      ) : error ? (
        <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-center text-[14px] font-semibold text-red-400">
          Erro ao carregar os palpites.
        </p>
      ) : palpites.length === 0 ? (
        <p className="py-10 text-center text-[14px] font-medium text-white/50">
          Ainda não há palpites dos jogadores neste bolão.
        </p>
      ) : (
        palpites.map((p, idx) => (
          <PalpiteCard key={`${p.userId}-${p.matchId}-${idx}`} p={p} />
        ))
      )}
    </div>
  );
}
