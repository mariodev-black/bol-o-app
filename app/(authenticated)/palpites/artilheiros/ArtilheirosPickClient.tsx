"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Search, Shield, X } from "lucide-react";
import type { ArtilheiroPickRow, ArtilheiroPlayerSummary, ArtilheiroTeamSummary } from "@/lib/artilheiros/types";
import type { ArtilheiroPickSlot } from "@/lib/artilheiros/config";
import { comparePlayersByJerseyNumber } from "@/lib/artilheiros/elencos-display";
import iconArtilheiro from "@/app/assets/icon-artilheiro.png";

const GREEN = "#B1EB0B";
const MODAL_EXIT_MS = 220;

type WizardStep = "team" | "player";

type SlotDisplay = {
  playerName: string;
  teamName: string;
  playerPhoto: string;
  locked: boolean;
};

function filterTeams(teams: ArtilheiroTeamSummary[], query: string): ArtilheiroTeamSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return teams;
  return teams.filter(
    (t) =>
      t.nome.toLowerCase().includes(q) ||
      t.displayNome.toLowerCase().includes(q) ||
      t.codigo.toLowerCase().includes(q) ||
      t.pais.toLowerCase().includes(q) ||
      (t.grupo?.toLowerCase().includes(q) ?? false) ||
      (t.grupoLabel?.toLowerCase().includes(q) ?? false),
  );
}

function filterPlayers(players: ArtilheiroPlayerSummary[], query: string): ArtilheiroPlayerSummary[] {
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? players
    : players.filter(
        (p) =>
          p.nome.toLowerCase().includes(q) ||
          p.posicao.toLowerCase().includes(q) ||
          p.posicaoLabel.toLowerCase().includes(q) ||
          String(p.numero ?? "").includes(q),
      );
  return [...filtered].sort(comparePlayersByJerseyNumber);
}

function getSlotDisplay(
  slot: ArtilheiroPickSlot,
  savedPicks: ArtilheiroPickRow[],
  draftBySlot: Partial<Record<ArtilheiroPickSlot, ArtilheiroPlayerSummary>>,
): SlotDisplay | null {
  const saved = savedPicks.find((p) => p.slot === slot);
  if (saved) {
    return {
      playerName: saved.playerName,
      teamName: saved.teamName,
      playerPhoto: saved.playerPhoto ?? "",
      locked: true,
    };
  }
  const draft = draftBySlot[slot];
  if (!draft) return null;
  return {
    playerName: draft.nome,
    teamName: draft.teamDisplayNome,
    playerPhoto: draft.foto,
    locked: false,
  };
}

function ConfirmPicksModal({
  open,
  onClose,
  onConfirm,
  saving,
  error,
  scoringRules,
  savedPicks,
  draftBySlot,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
  error: string | null;
  scoringRules: Props["scoringRules"];
  savedPicks: ArtilheiroPickRow[];
  draftBySlot: Partial<Record<ArtilheiroPickSlot, ArtilheiroPlayerSummary>>;
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!portalReady) return;
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (mounted) setClosing(true);
  }, [open, portalReady, mounted]);

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, MODAL_EXIT_MS);
    return () => window.clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    if (!mounted || closing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, closing]);

  const requestClose = useCallback(() => {
    if (saving) return;
    onClose();
  }, [onClose, saving]);

  useEffect(() => {
    if (!mounted || closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, closing, requestClose]);

  if (!portalReady || (!open && !mounted)) return null;

  const overlayAnim = closing
    ? "animate-ranking-steps-overlay-out"
    : "animate-ranking-steps-overlay-in";
  const panelAnim = closing
    ? "animate-ranking-steps-panel-out"
    : "animate-ranking-steps-panel-in";

  return createPortal(
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="artilheiros-confirm-title"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/80 backdrop-blur-[8px] ${overlayAnim}`}
        aria-label="Fechar"
        onClick={requestClose}
      />

      <div
        className={`relative z-[1] w-full max-w-[400px] overflow-hidden rounded-t-[20px] border border-white/10 bg-[#111] shadow-[0_24px_64px_rgba(0,0,0,0.75)] sm:rounded-[20px] ${panelAnim}`}
      >
        <div className="border-b border-white/8 px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                Confirmação final
              </p>
              <h2
                id="artilheiros-confirm-title"
                className="mt-1 text-[20px] font-black uppercase leading-tight text-white"
              >
                Seus 3 artilheiros
              </h2>
              <p className="mt-1.5 text-[13px] leading-snug text-white/50">
                Após confirmar, os palpites ficam bloqueados e não podem ser alterados.
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={saving}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2.5 px-5 py-4">
          {scoringRules.slots.map((meta) => {
            const display = getSlotDisplay(meta.slot, savedPicks, draftBySlot);
            if (!display) return null;
            return (
              <div
                key={meta.slot}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-white/10">
                  {display.playerPhoto ? (
                    <Image
                      src={display.playerPhoto}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <Image src={iconArtilheiro} alt="" fill className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-primary">
                    {meta.label}
                  </p>
                  <p className="truncate text-[15px] font-bold text-white">{display.playerName}</p>
                  <p className="truncate text-[12px] text-white/45">{display.teamName}</p>
                </div>
                <span className="shrink-0 text-[12px] font-bold text-primary">{meta.points} pts</span>
              </div>
            );
          })}
        </div>

        {error ? (
          <p className="mx-5 mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2.5 border-t border-white/8 px-5 py-4">
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="h-12 flex-1 rounded-xl border border-white/15 text-[14px] font-bold uppercase tracking-wide text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:opacity-40"
          >
            Revisar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex h-12 flex-[1.35] items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-black uppercase tracking-wide text-black transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando…
              </>
            ) : (
              "Confirmar palpites"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ScoringRulesSection({
  scoringRules,
}: {
  scoringRules: Props["scoringRules"];
}) {
  return (
    <section className="mt-10 rounded-[24px] bg-[#101010] px-4 py-5 shadow-[0_10px_28px_rgba(0,0,0,0.22)] ring-1 ring-white/4">
      <div className="mb-5">
        <p className="text-[12px] font-black uppercase tracking-[0.18em] text-primary/90">
          Premiação
        </p>
        <h3 className="mt-1 text-[24px] font-black tracking-[-0.03em] text-white">
          Pontuação do palpite
        </h3>
        <p className="mt-2 max-w-[340px] text-[14px] leading-relaxed text-white/46">
          A posição exata vale mais. Jogadores que fecharem no top 3 ainda somam bônus.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {scoringRules.slots.map((s, index) => (
          <article key={s.slot} className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/32">
              0{index + 1}
            </p>
            <p className="mt-2 text-[14px] font-bold leading-tight text-white">
              {s.label}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-white/38">
              posição exata
            </p>
            <p className="mt-4 text-[32px] font-black leading-none tracking-[-0.05em] text-primary">
              {s.points}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/30">
              pontos
            </p>
          </article>
        ))}
      </div>

      <div className="my-5 h-px w-full bg-white/6" />

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/32">
            Bônus
          </p>
          <p className="mt-2 text-[15px] font-bold leading-tight text-white">
            Jogador entre os 3 artilheiros
          </p>
          <p className="mt-1 text-[12px] leading-snug text-white/38">
            mesmo sem acertar a posição final
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[32px] font-black leading-none tracking-[-0.05em] text-primary">
            +{scoringRules.top3Bonus}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/30">
            pontos
          </p>
        </div>
      </div>
    </section>
  );
}

type Props = {
  ticketId: string;
  initialPicks: ArtilheiroPickRow[];
  resultsApplied: boolean;
  allTeams: ArtilheiroTeamSummary[];
  playersByTeam: Record<number, ArtilheiroPlayerSummary[]>;
  scoringRules: {
    title: string;
    slots: Array<{ slot: ArtilheiroPickSlot; emoji: string; label: string; points: number }>;
    top3Bonus: number;
  };
};

export default function ArtilheirosPickClient({
  ticketId,
  initialPicks,
  resultsApplied,
  allTeams,
  playersByTeam,
  scoringRules,
}: Props) {
  const [savedPicks, setSavedPicks] = useState(initialPicks);
  const [draftBySlot, setDraftBySlot] = useState<
    Partial<Record<ArtilheiroPickSlot, ArtilheiroPlayerSummary>>
  >({});
  const [nextSlot, setNextSlot] = useState<ArtilheiroPickSlot | null>(() => {
    if (initialPicks.length >= 3) return null;
    const slots: ArtilheiroPickSlot[] = [1, 2, 3];
    return slots.find((s) => !initialPicks.some((p) => p.slot === s)) ?? null;
  });
  const [wizardStep, setWizardStep] = useState<WizardStep>("team");
  const [selectedTeam, setSelectedTeam] = useState<ArtilheiroTeamSummary | null>(null);
  const [teamQuery, setTeamQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedComplete = savedPicks.length >= 3;
  const allSlotsFilled = useMemo(
    () =>
      ([1, 2, 3] as ArtilheiroPickSlot[]).every(
        (slot) => getSlotDisplay(slot, savedPicks, draftBySlot) != null,
      ),
    [savedPicks, draftBySlot],
  );

  const usedPlayerIds = useMemo(() => {
    const ids = new Set<number>();
    for (const p of savedPicks) ids.add(p.apiPlayerId);
    for (const d of Object.values(draftBySlot)) {
      if (d) ids.add(d.apiPlayerId);
    }
    return ids;
  }, [savedPicks, draftBySlot]);

  const activeSlotMeta = useMemo(
    () => scoringRules.slots.find((s) => s.slot === nextSlot) ?? null,
    [nextSlot, scoringRules.slots],
  );

  const teams = useMemo(() => filterTeams(allTeams, teamQuery), [allTeams, teamQuery]);

  const players = useMemo(() => {
    if (!selectedTeam) return [];
    const base = playersByTeam[selectedTeam.apiTeamId] ?? [];
    return filterPlayers(base, playerQuery);
  }, [selectedTeam, playersByTeam, playerQuery]);

  useEffect(() => {
    if (wizardStep !== "player" || !selectedTeam) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [wizardStep, selectedTeam]);

  useEffect(() => {
    if (wizardStep !== "team" || selectedTeam || confirmOpen) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [wizardStep, selectedTeam, nextSlot, confirmOpen]);

  function selectPlayer(player: ArtilheiroPlayerSummary) {
    if (!nextSlot || saving) return;
    if (usedPlayerIds.has(player.apiPlayerId)) return;

    setError(null);
    const newDraft = { ...draftBySlot, [nextSlot]: player };
    setDraftBySlot(newDraft);
    setSelectedTeam(null);
    setPlayerQuery("");
    setTeamQuery("");
    setWizardStep("team");

    const slots: ArtilheiroPickSlot[] = [1, 2, 3];
    const allFilled = slots.every((slot) => getSlotDisplay(slot, savedPicks, newDraft) != null);

    if (allFilled) {
      setNextSlot(null);
      setConfirmOpen(true);
      return;
    }

    const next = slots.find((slot) => getSlotDisplay(slot, savedPicks, newDraft) == null) ?? null;
    setNextSlot(next);
  }

  async function confirmAllPicks() {
    if (saving || savedComplete) return;

    const picksToSave = ([1, 2, 3] as ArtilheiroPickSlot[])
      .filter((slot) => !savedPicks.some((p) => p.slot === slot))
      .map((slot) => {
        const draft = draftBySlot[slot];
        if (!draft) return null;
        return {
          slot,
          apiPlayerId: draft.apiPlayerId,
          apiTeamId: draft.apiTeamId,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);

    if (picksToSave.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/artilheiros/picks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, picks: picksToSave }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro ao confirmar palpites");
      setSavedPicks(j.picks ?? []);
      setDraftBySlot({});
      setConfirmOpen(false);
      setNextSlot(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function startSlot(slot: ArtilheiroPickSlot) {
    if (savedPicks.some((p) => p.slot === slot) || resultsApplied || savedComplete) return;
    setConfirmOpen(false);
    setNextSlot(slot);
    setWizardStep("team");
    setSelectedTeam(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-black pb-16 text-white">
      <ConfirmPicksModal
        open={confirmOpen && allSlotsFilled && !savedComplete}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void confirmAllPicks()}
        saving={saving}
        error={confirmOpen ? error : null}
        scoringRules={scoringRules}
        savedPicks={savedPicks}
        draftBySlot={draftBySlot}
      />

      <div className="mx-auto w-full max-w-[430px] px-4 pt-4">
        <div className="mb-5 flex items-center gap-3">
          <Link
            href="/boloes"
            className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
              Copa 2026
            </p>
            <h1 className="truncate text-[18px] font-black uppercase leading-tight">
              {scoringRules.title}
            </h1>
          </div>
        </div>

        <section className="mb-5 grid grid-cols-3 gap-2">
          {scoringRules.slots.map((meta) => {
            const display = getSlotDisplay(meta.slot, savedPicks, draftBySlot);
            const isActive = nextSlot === meta.slot && !savedComplete && !resultsApplied;
            const filled = Boolean(display);
            const locked = display?.locked ?? false;
            return (
              <button
                key={meta.slot}
                type="button"
                disabled={locked || resultsApplied || savedComplete}
                onClick={() => startSlot(meta.slot)}
                className={[
                  "flex flex-col items-center rounded-[14px] border p-2.5 text-center transition-colors",
                  filled
                    ? "border-primary/35 bg-primary/8"
                    : isActive
                      ? "border-primary bg-primary/10"
                      : "border-white/10 bg-[#111] hover:border-white/20",
                ].join(" ")}
              >
                <div className="relative mx-auto size-[52px] shrink-0">
                  <div
                    className={[
                      "relative size-full overflow-hidden rounded-full",
                      filled ? "ring-2 ring-primary/40" : "bg-white/5",
                    ].join(" ")}
                  >
                    {display?.playerPhoto ? (
                      <Image
                        src={display.playerPhoto}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Image
                        src={iconArtilheiro}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  {filled ? (
                    <span className="absolute -bottom-0.5 -right-0.5 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-black ring-2 ring-black">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 w-full text-[12px] font-black uppercase leading-tight tracking-[0.04em] text-white/90">
                  {meta.label}
                </p>

                {display ? (
                  <div className="mt-1.5 w-full min-w-0">
                    <p className="truncate text-[12px] font-bold leading-tight text-white">
                      {display.playerName}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] leading-tight text-white/45">
                      {display.teamName}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[12px] leading-snug text-white/45">
                    {isActive ? "Selecionando…" : "Toque p/ escolher"}
                  </p>
                )}
              </button>
            );
          })}
        </section>

        {savedComplete ? (
          <div className="rounded-[16px] border border-primary/25 bg-primary/10 p-4 text-center">
            <Shield className="mx-auto size-8 text-primary" />
            <p className="mt-2 text-[15px] font-black uppercase">Palpites confirmados</p>
            <p className="mt-1 text-[13px] text-white/55">
              Seus 3 artilheiros estão bloqueados e não podem ser alterados.
            </p>
          </div>
        ) : resultsApplied ? (
          <div className="rounded-[16px] border border-white/10 bg-[#111] p-4 text-center text-[13px] text-white/55">
            Bolão encerrado — resultado oficial aplicado.
          </div>
        ) : nextSlot && activeSlotMeta && !confirmOpen ? (
          <section>
            <div className="mb-5 flex items-center gap-3">
              <div className="min-w-0 shrink-0">
                <p className="text-[12px] font-black uppercase tracking-[0.14em] text-primary">
                  Passo {wizardStep === "team" ? "1" : "2"} de 2
                </p>
                <p className="text-[17px] font-black uppercase leading-tight">
                  {activeSlotMeta.label}
                </p>
              </div>

              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                <input
                  value={wizardStep === "team" ? teamQuery : playerQuery}
                  onChange={(e) =>
                    wizardStep === "team"
                      ? setTeamQuery(e.target.value)
                      : setPlayerQuery(e.target.value)
                  }
                  placeholder={wizardStep === "team" ? "Buscar seleção…" : "Buscar jogador…"}
                  className="h-11 w-full rounded-full border border-primary/35 bg-[#0a0a0a] pl-10 pr-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/35 focus:border-primary"
                />
              </div>
            </div>

            {error ? (
              <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[14px] text-red-300">
                {error}
              </p>
            ) : null}

            {wizardStep === "team" ? (
              teams.length === 0 ? (
                <p className="py-8 text-center text-[15px] text-white/45">Nenhuma seleção encontrada.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {teams.map((team) => (
                    <button
                      key={team.apiTeamId}
                      type="button"
                      onClick={() => {
                        setSelectedTeam(team);
                        setWizardStep("player");
                        setPlayerQuery("");
                      }}
                      className="group flex flex-col items-center rounded-2xl border border-white/10 bg-[#111] px-2 py-3 text-center transition-all hover:border-primary/40 hover:bg-[#161616] active:scale-[0.98]"
                    >
                      <div className="relative mb-2 size-14 shrink-0">
                        <Image
                          src={team.logo}
                          alt=""
                          fill
                          className="object-contain drop-shadow-sm"
                          unoptimized
                        />
                      </div>
                      <p className="w-full truncate px-0.5 text-[13px] font-bold leading-tight text-white">
                        {team.displayNome}
                      </p>
                      <p className="mt-1 w-full px-0.5 text-[11px] leading-snug text-white/45">
                        {team.codigo}
                        {team.grupoLabel ? ` · ${team.grupoLabel}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )
            ) : selectedTeam ? (
              <>
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setWizardStep("team");
                      setPlayerQuery("");
                    }}
                    aria-label="Voltar para seleções"
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0a0a0a] text-white/70 transition-colors hover:border-primary/40 hover:text-primary active:scale-95"
                  >
                    <ArrowLeft className="size-5" strokeWidth={2.5} />
                  </button>
                  <div className="relative size-10 shrink-0">
                    <Image
                      src={selectedTeam.logo}
                      alt=""
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold">{selectedTeam.displayNome}</p>
                    <p className="text-[12px] text-white/45">
                      {selectedTeam.codigo}
                      {selectedTeam.grupoLabel ? ` · ${selectedTeam.grupoLabel}` : ""}
                    </p>
                  </div>
                </div>

                {players.length === 0 ? (
                  <p className="py-8 text-center text-[15px] text-white/45">Nenhum jogador encontrado.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    {players.map((player) => {
                      const taken = ([1, 2, 3] as ArtilheiroPickSlot[]).some((slot) => {
                        if (slot === nextSlot) return false;
                        const saved = savedPicks.find((p) => p.slot === slot);
                        if (saved?.apiPlayerId === player.apiPlayerId) return true;
                        return draftBySlot[slot]?.apiPlayerId === player.apiPlayerId;
                      });
                      return (
                        <button
                          key={player.apiPlayerId}
                          type="button"
                          disabled={taken}
                          onClick={() => selectPlayer(player)}
                          className="group flex flex-col items-center rounded-xl border border-white/10 bg-[#111] px-1.5 py-2 text-center transition-all hover:border-primary/40 hover:bg-[#161616] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                        >
                          <div className="relative mb-2 size-[72px] w-full max-w-[80px] shrink-0 overflow-hidden rounded-md border border-white/15 bg-white/10">
                            <Image
                              src={player.foto}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <p className="w-full truncate px-0.5 text-[13px] font-bold leading-tight text-white min-[360px]:text-[14px]">
                            {player.nome}
                          </p>
                          <p className="mt-0.5 w-full truncate px-0.5 text-[11px] leading-snug text-white/45 min-[360px]:text-[12px]">
                            {player.posicaoLabel}
                            {player.numero != null ? ` · #${player.numero}` : ""}
                          </p>
                          {taken ? (
                            <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/35">
                              Usado
                            </span>
                          ) : (
                            <span
                              className="mt-1 text-[11px] font-black uppercase tracking-wide"
                              style={{ color: GREEN }}
                            >
                              Escolher
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : null}
          </section>
        ) : allSlotsFilled && !savedComplete ? (
          <p className="text-center text-[14px] text-white/50">
            Revise seus palpites no modal de confirmação acima.
          </p>
        ) : (
          <p className="text-center text-[13px] text-white/45">
            Toque em um slot acima para começar sua escolha.
          </p>
        )}

        <ScoringRulesSection scoringRules={scoringRules} />
      </div>
    </div>
  );
}
