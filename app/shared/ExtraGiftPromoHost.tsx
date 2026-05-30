"use client";

/**
 * Modal "Brinde extra grátis" — exibido pós-login.
 *
 *   STEP 1 → oferta (só se o GET indicar `showOfferModal`).
 *   STEP 2 → confirmação após POST bem-sucedido.
 *
 * Visibilidade e “já resgatou” vêm só do backend (GET/POST `/api/promotions/extra-gift`).
 * Sem localStorage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";
import confetti from "canvas-confetti";
import { useIsAdminAppRoute } from "@/app/shared/app-route-guards";
import { useAuth } from "@/app/shared/AuthContext";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { extraBolaoIconSrc } from "@/app/shared/extra-bolao-icons";
import type { ExtraGiftLeagueKind } from "@/lib/promotions/extra-gift";
import { getExtraBolaoFirstPlaceLine } from "@/lib/boloes-prize-copy";
import poupUpImage from "@/app/assets/poup-up.png";

const audioTorcidaSrc = "/audio/audio-torcida.mp3";
const PROMO_FONT = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";

type ExtraGiftLeagueRow = {
  championshipId: number;
  displayName: string;
  leagueKind: ExtraGiftLeagueKind;
  rodada: number | null;
  rodadaNome: string | null;
  alreadyClaimed: boolean;
};

type ExtraGiftStatus = {
  enabled: boolean;
  prizeLabel: string;
  displayName: string;
  offerSubtitle: string;
  leagues: ExtraGiftLeagueRow[];
  allClaimed: boolean;
  canClaim: boolean;
  showOfferModal: boolean;
  alreadyClaimed: boolean;
};

type ClaimedTicketRow = {
  championshipId: number;
  displayName: string;
  leagueKind: ExtraGiftLeagueKind;
  ticketId: string;
  rodada: number;
  rodadaNome: string;
};

type Step = "offer" | "claimed";

function leagueIconVariant(kind: ExtraGiftLeagueKind) {
  return kind === "brasileirao"
    ? "brasileirao"
    : kind === "premier_league"
      ? "premier_league"
      : kind === "libertadores"
        ? "libertadores"
        : "generic";
}

function filterExtraGiftDisplayLeagues<T extends { leagueKind: ExtraGiftLeagueKind }>(
  rows: readonly T[],
): T[] {
  return rows.filter(
    (row) => row.leagueKind !== "premier_league" && row.leagueKind !== "libertadores",
  );
}

function OfferStep({
  status,
  loading,
  onClaim,
  onClose,
}: {
  status: ExtraGiftStatus;
  loading: boolean;
  onClaim: () => void;
  onClose: () => void;
}) {
  const pendingLeagues = filterExtraGiftDisplayLeagues(status.leagues);
  const pendingCount = pendingLeagues.filter((l) => !l.alreadyClaimed).length;
  const cotaCount = pendingCount > 0 ? pendingCount : pendingLeagues.length;

  return (
    <div
      className="relative w-full max-w-[350px] pt-[240px]"
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 flex w-full justify-center"
        aria-hidden
      >
        <Image
          src={poupUpImage}
          alt=""
          priority
          draggable={false}
          className="h-auto w-full select-none rounded-t-3xl drop-shadow-[0_14px_24px_rgba(0,0,0,0.55)]"
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar promoção"
        className="absolute right-1 top-1 z-30 flex size-9 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <X className="size-4" strokeWidth={2.5} aria-hidden />
      </button>

      <div
        className="relative z-10 rounded-4xl bg-[#141414] px-6 pb-6 pt-8"
        id="extra-gift-promo-card"
      >
        <h2
          id="extra-gift-promo-title"
          className="text-center text-[30px] font-black uppercase leading-[1.02] tracking-tight text-primary sm:text-[28px]"
          style={{ textShadow: "0 0 18px rgba(177,235,11,0.28)" }}
        >
          <span className="text-white">Você ganhou</span>
          <br />
          {cotaCount} {cotaCount === 1 ? "cota grátis" : "cotas grátis"}!
        </h2>

        <p className="mt-6 mb-2 text-center text-[16px] font-bold leading-snug text-white">
          {status.offerSubtitle}
        </p>

        <button
          type="button"
          disabled={loading || !status.canClaim || status.allClaimed}
          onClick={onClaim}
          className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-full bg-primary px-4 text-[13px] font-black uppercase tracking-wide text-[#0E141B] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Resgatando..." : `Resgatar ${cotaCount} ${cotaCount === 1 ? "cota" : "cotas"}`}
        </button>
      </div>
    </div>
  );
}

function ClaimedStep({
  leagues,
  onPlay,
  onClose,
}: {
  leagues: ClaimedTicketRow[];
  onPlay: () => void;
  onClose: () => void;
}) {
  const sorted = [...filterExtraGiftDisplayLeagues(leagues)].sort(
    (a, b) => a.championshipId - b.championshipId,
  );

  return (
    <div
      className="relative w-full max-w-[320px] rounded-2xl border border-white/10 bg-[#141414] px-4 pb-4 pt-10"
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-black/60 text-white/90 transition-colors hover:bg-black"
      >
        <X className="size-3.5" strokeWidth={2.5} aria-hidden />
      </button>

      <header className="text-center">
        <div
          className="mx-auto mb-2.5 flex size-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/50"
          aria-hidden
        >
          <Check className="size-5 text-primary" strokeWidth={2.5} />
        </div>
        <h2
          id="extra-gift-claimed-title"
          className="text-[17px] font-black uppercase tracking-tight text-white"
        >
          Cotas liberadas
        </h2>
        <p className="mt-1 text-[12px] font-medium leading-snug text-white/65">
          {sorted.length > 1
            ? "Você ganhou 1 cota grátis em cada bolão extra:"
            : "Sua cota grátis já está na sua conta."}
        </p>
      </header>

      <ul className="mt-4 space-y-2">
        {sorted.map((league) => (
          <li
            key={league.championshipId}
            className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-[#1a1a1a] px-2.5 py-2"
          >
            <Image
              src={extraBolaoIconSrc(leagueIconVariant(league.leagueKind))}
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold uppercase tracking-wide text-white">
                {league.displayName}
              </p>
              <p className="text-[11px] font-medium text-white/55">
                1 cota grátis · {league.rodadaNome}
              </p>
            </div>
            <p className="shrink-0 max-w-[108px] text-right text-[10px] font-bold leading-snug text-primary">
              {getExtraBolaoFirstPlaceLine(league.championshipId, league.displayName)}
            </p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onPlay}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-[12px] font-black uppercase tracking-wide text-[#0E141B] transition-transform active:scale-[0.98]"
      >
        Ir para meus bolões
        <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}

export function ExtraGiftPromoHost({ children }: { children: React.ReactNode }) {
  const { ready, isLoggedIn, user } = useAuth();
  const isAdminRoute = useIsAdminAppRoute();
  const router = useRouter();
  const toast = useBolaoToast();

  const [status, setStatus] = useState<ExtraGiftStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("offer");
  const [claiming, setClaiming] = useState(false);
  const [claimedTickets, setClaimedTickets] = useState<ClaimedTicketRow[]>([]);

  const claimingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio(audioTorcidaSrc);
    audio.preload = "auto";
    audio.volume = 1;
    audioRef.current = audio;
    try {
      const AudioCtxClass =
        typeof window !== "undefined"
          ? window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext
          : undefined;
      if (AudioCtxClass) {
        const ctx = new AudioCtxClass();
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 1.6;
        source.connect(gain).connect(ctx.destination);
        audioCtxRef.current = ctx;
      }
    } catch {
      /* playback simples */
    }
    return audio;
  }, []);

  const playAudio = useCallback(() => {
    const audio = ensureAudio();
    try {
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
    audio.volume = 1;
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    void audio.play().catch(() => {});
  }, [ensureAudio]);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
  }, []);

  const profileBlocksPromo = Boolean(user && user.profileComplete === false);

  const refreshStatus = useCallback(async (): Promise<ExtraGiftStatus | null> => {
    const r = await fetch("/api/promotions/extra-gift", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as ExtraGiftStatus;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (isAdminRoute || !ready || !isLoggedIn || profileBlocksPromo || !user?.id) {
      setOpen(false);
      setStatus(null);
      return;
    }

    (async () => {
      try {
        const data = await refreshStatus();
        if (cancelled) return;
        setStatus(data);
        if (!data?.enabled || !data.showOfferModal || data.leagues.length === 0) {
          setOpen(false);
          return;
        }
        setStep("offer");
        setOpen(true);
      } catch {
        if (!cancelled) {
          setStatus(null);
          setOpen(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdminRoute, ready, isLoggedIn, profileBlocksPromo, user?.id, refreshStatus]);

  const handleOfferClose = useCallback(() => {
    stopAudio();
    setOpen(false);
  }, [stopAudio]);

  const handleClaim = useCallback(async () => {
    if (claimingRef.current) return;
    if (!status?.canClaim || status.allClaimed || !status.showOfferModal) {
      toast.error("Você já resgatou as cotas grátis desta promoção.");
      return;
    }

    playAudio();
    claimingRef.current = true;
    setClaiming(true);
    try {
      const r = await fetch("/api/promotions/extra-gift", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await r.json()) as {
        ok?: boolean;
        tickets?: ClaimedTicketRow[];
        error?: string;
      };
      if (!r.ok || !data.ok || !data.tickets?.length) {
        toast.error(data.error ?? "Não foi possível resgatar o brinde agora.");
        const fresh = await refreshStatus();
        if (fresh) setStatus(fresh);
        if (fresh && !fresh.showOfferModal) setOpen(false);
        return;
      }

      const rows: ClaimedTicketRow[] = filterExtraGiftDisplayLeagues(
        data.tickets.map((t) => ({
          championshipId: t.championshipId,
          displayName: t.displayName,
          leagueKind: t.leagueKind,
          ticketId: t.ticketId,
          rodada: t.rodada,
          rodadaNome: t.rodadaNome?.trim() || `${t.rodada}ª Rodada`,
        })),
      );

      setClaimedTickets(rows);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              alreadyClaimed: true,
              allClaimed: true,
              canClaim: false,
              showOfferModal: false,
            }
          : prev,
      );
      setStep("claimed");
    } catch {
      toast.error("Erro de rede ao resgatar o brinde.");
    } finally {
      claimingRef.current = false;
      setClaiming(false);
    }
  }, [status, toast, playAudio, refreshStatus]);

  const handlePlay = useCallback(() => {
    stopAudio();
    setOpen(false);
    router.push("/boloes?fromExtraGift=1");
  }, [router, stopAudio]);

  const handleClaimedClose = useCallback(() => {
    stopAudio();
    setOpen(false);
  }, [stopAudio]);

  useEffect(() => {
    if (!open || step !== "claimed") return;
    if (typeof window === "undefined") return;

    const colors = ["#B1EB0B", "#7FB300", "#D2FF6F", "#E2D5B8", "#FFFFFF"];
    confetti({
      particleCount: 140,
      spread: 110,
      origin: { y: 0.55 },
      colors,
      zIndex: 9999,
      startVelocity: 48,
      scalar: 1.05,
      ticks: 220,
    });

    const end = Date.now() + 1600;
    let raf = 0;
    const frame = () => {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.85 },
        colors,
        zIndex: 9999,
        startVelocity: 55,
        ticks: 200,
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.85 },
        colors,
        zIndex: 9999,
        startVelocity: 55,
        ticks: 200,
      });
      if (Date.now() < end) {
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) stopAudio();
  }, [open, stopAudio]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audioRef.current = null;
      }
      const ctx = audioCtxRef.current;
      if (ctx) {
        void ctx.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  const showModal = open && status != null && !isAdminRoute;

  return (
    <>
      {children}
      {showModal ? (
        <div
          className="fixed inset-0 z-110 flex items-center justify-center bg-black/85 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={step === "offer" ? "extra-gift-promo-title" : "extra-gift-claimed-title"}
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (step === "offer") handleOfferClose();
            else handleClaimedClose();
          }}
        >
          {step === "offer" ? (
            <OfferStep
              status={status}
              loading={claiming}
              onClaim={handleClaim}
              onClose={handleOfferClose}
            />
          ) : (
            <ClaimedStep
              leagues={claimedTickets}
              onPlay={handlePlay}
              onClose={handleClaimedClose}
            />
          )}
        </div>
      ) : null}
    </>
  );
}
