"use client";

/**
 * Modal "Brinde extra grátis por rodada" — exibido pós-login.
 *
 * Dois passos:
 *
 *   STEP 1 ("offer")   →  "Você ganhou 2 BOLÕES GRÁTIS" — Brasileirão + Libertadores,
 *                         valendo R$ 10 mil em prêmios em cada bilhete.
 *                         Botão "RESGATAR MEUS 2 BOLÕES" chama POST `/api/promotions/extra-gift`.
 *                         Checkbox "Não exibir isso novamente" persiste no localStorage
 *                         (chave por championship + rodada — reabre quando muda a rodada).
 *
 *   STEP 2 ("claimed") →  confirmação minimalista com ícone por liga (Brasileirão + Premier).
 *                         CTA leva para `/boloes`.
 *
 * Regras:
 *   - Aparece só quando `enabled && canClaim && !dismissedForBundle`.
 *   - Se o usuário fecha sem resgatar, o modal volta no próximo login a menos que
 *     marque "não exibir novamente".
 *   - O resgate é idempotente no backend — múltiplos clicks geram o mesmo ticket.
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
import poupUpImage from "@/app/assets/poup-up.png";

/** URL pública do mp3 de torcida. Mantemos em `/public/audio/` em vez de
 *  importar como módulo porque o Turbopack do Next.js não trata `.mp3`
 *  como asset por default. Servido como static asset, é universal. */
const audioTorcidaSrc = "/audio/audio-torcida.mp3";

const PROMO_FONT = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";
/** localStorage — sufixo bundle `10:12|69:8` (campeonato:rodada por liga). */
const DISMISS_PREFIX = "bolao_extra_gift_dismissed_v2";

type ExtraGiftLeagueRow = {
  championshipId: number;
  displayName: string;
  leagueKind: ExtraGiftLeagueKind;
  rodada: number | null;
  rodadaNome: string | null;
};

type ExtraGiftStatus = {
  enabled: boolean;
  prizeLabel: string;
  displayName: string;
  leagues: ExtraGiftLeagueRow[];
  allClaimed: boolean;
  canClaim: boolean;
  dismissBundleKey: string;
  championshipId: number | null;
  rodada: number | null;
  alreadyClaimed: boolean;
  ticketId: string | null;
};

type ClaimedTicketRow = {
  championshipId: number;
  displayName: string;
  leagueKind: ExtraGiftLeagueKind;
  ticketId: string;
};

type Step = "offer" | "claimed";

function dismissStorageKey(bundleKey: string): string {
  return `${DISMISS_PREFIX}:${bundleKey}`;
}

function readDismissed(bundleKey: string): boolean {
  if (!bundleKey || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(dismissStorageKey(bundleKey)) === "1";
  } catch {
    return false;
  }
}

function persistDismissed(bundleKey: string): void {
  if (!bundleKey) return;
  try {
    window.localStorage.setItem(dismissStorageKey(bundleKey), "1");
  } catch {
    /* localStorage indisponível — sem-op (modal volta no próximo login). */
  }
}

function leagueIconVariant(kind: ExtraGiftLeagueKind) {
  return kind === "brasileirao"
    ? "brasileirao"
    : kind === "premier_league"
      ? "premier_league"
      : "generic";
}

/* -------------------------------------------------------------------------- */
/*  STEP 1 — Oferta                                                            */
/*                                                                              */
/*  Layout inspirado na referência da Aposta Ganha:                            */
/*   - Foto do mascote/personagem "vaza" do topo do card (parte da arte fica   */
/*     visível ACIMA da borda superior, criando profundidade).                 */
/*   - Card preto com borda primary, cantos generosos.                         */
/*   - Tipografia uppercase, hierarquia simples: título grande primary,        */
/*     subtítulo branco compacto, microcopy menor, CTA pill primary.           */
/*   - Apenas informações ESSENCIAIS: nome do produto, rodada, prêmio, ação.   */
/* -------------------------------------------------------------------------- */

function OfferStep({
  status,
  loading,
  onClaim,
  onClose,
}: {
  status: ExtraGiftStatus;
  loading: boolean;
  onClaim: () => void;
  onClose: (permanent: boolean) => void;
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => onClose(dontShowAgain);
  const cotaCount = Math.max(1, status.leagues.length);

  return (
    // Wrapper externo: relativo + padding-top que reserva espaço pra a imagem
    // "vazar" acima do topo do card. A imagem fica em z-0 (fundo) — a metade
    // de cima dela aparece nos `pt-[140px]` reservados, a metade de baixo
    // fica naturalmente OCULTA atrás do card opaco (z-10).
    <div
      className="relative w-full max-w-[350px] pt-[240px]"
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Imagem do mascote — camada de fundo (z-0). O card opaco em z-10 cobre
          o que estiver dentro da área dele, criando o efeito de "vazar". */}
      <div
        className="w-full pointer-events-none absolute inset-x-0 top-0 z-0 flex justify-center"
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

      {/* Botão X — sempre por cima (z-30) pra ficar clicável sobre a imagem */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Fechar promoção"
        className="absolute right-1 top-1 z-30 flex size-9 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <X className="size-4" strokeWidth={2.5} aria-hidden />
      </button>

      {/* Card — z-10 cobre a parte INFERIOR da imagem e fica acima dela. */}
      <div
        className="relative z-10 rounded-4xl bg-[#141414] px-6 pb-6 pt-8"
        id="extra-gift-promo-card"
      >
        {/* Título — destaca "2" + "bolões grátis" pra comunicar de cara o duplo benefício */}
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
          Brasileirão e Premier League · valendo {status.prizeLabel} cada
        </p>

        <button
          type="button"
          disabled={loading}
          onClick={onClaim}
          className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-full bg-primary px-4 text-[13px] font-black uppercase tracking-wide text-[#0E141B] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Resgatando..." : `Resgatar ${cotaCount} cotas`}
        </button>

        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 text-[11px] font-medium text-white/50">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="size-3.5 rounded border-white/30 accent-primary"
          />
          Não exibir novamente nesta rodada
        </label>

      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  STEP 2 — Confirmação (Bolão liberado)                                      */
/* -------------------------------------------------------------------------- */

function ClaimedStep({
  prizeLabel,
  leagues,
  onPlay,
  onClose,
}: {
  prizeLabel: string;
  leagues: ClaimedTicketRow[];
  onPlay: () => void;
  onClose: () => void;
}) {
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
          {leagues.length > 1
            ? "Você ganhou 1 cota grátis em cada bolão extra:"
            : "Sua cota grátis já está na sua conta."}
        </p>
      </header>

      <ul className="mt-4 space-y-2">
        {leagues.map((league) => (
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
              <p className="text-[11px] font-medium text-white/55">1 cota grátis</p>
            </div>
            <p className="shrink-0 text-right text-[10px] font-bold uppercase leading-tight text-primary">
              Valendo
              <br />
              <span className="text-[11px] text-white">{prizeLabel}</span>
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

/* -------------------------------------------------------------------------- */
/*  Host                                                                       */
/* -------------------------------------------------------------------------- */

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

  /** Última combinação user+championship+rodada já consultada — evita refetch
   *  redundante (ex: re-renders do AuthContext em StrictMode). */
  const lastFetchRef = useRef<string | null>(null);
  /** Trava de claim independente do state — imune a strict mode / double click
   *  rapidíssimos onde dois eventos podem ser despachados antes de qualquer
   *  rerender consumir o `claiming=true`. */
  const claimingRef = useRef(false);

  /** HTMLAudioElement do "audio-torcida.mp3" — instanciado lazy no 1º click
   *  pra evitar download desnecessário antes do usuário interagir. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** AudioContext com GainNode acoplado pra dar BOOST acima do volume nativo
   *  (HTMLAudioElement clampa em 1.0; o GainNode em 1.6 faz +60% de ganho). */
  const audioCtxRef = useRef<AudioContext | null>(null);

  /** Cria (se preciso) o HTMLAudioElement + pipeline Web Audio com gain extra.
   *  O Web Audio é "best-effort" — se algo falhar, o playback simples (volume 1)
   *  ainda acontece e o usuário ouve. */
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
      /* boost indisponível — playback continua via HTMLAudioElement em volume max */
    }
    return audio;
  }, []);

  /** Toca o áudio do zero. DEVE ser chamado SINCRONAMENTE dentro do
   *  click handler (sem await antes) pra estar dentro do "user gesture"
   *  que os navegadores exigem pra liberar áudio. */
  const playAudio = useCallback(() => {
    const audio = ensureAudio();
    try {
      audio.currentTime = 0;
    } catch {
      /* alguns browsers reclamam se setar antes do metadata carregar — ignora */
    }
    audio.volume = 1;
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    void audio.play().catch(() => {
      /* autoplay bloqueado num cenário extremo — segue sem áudio,
         o resgate em si continua funcionando normalmente. */
    });
  }, [ensureAudio]);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      /* idem — ignora se metadata ainda não estiver pronto */
    }
  }, []);

  const profileBlocksPromo = Boolean(user && user.profileComplete === false);

  /** Busca o status do brinde para o usuário logado.
   *  Não mostra o modal se: deslogado, perfil incompleto, promo desligada,
   *  já resgatou esta rodada, ou marcou "não exibir novamente".
   *
   *  Refetch acontece sempre que `user.id` muda (login / logout / troca de
   *  conta). Mudanças de rodada do lado do servidor aparecem no próximo
   *  carregamento da página — não há polling. */
  useEffect(() => {
    let cancelled = false;
    if (isAdminRoute || !ready || !isLoggedIn || profileBlocksPromo || !user?.id) {
      setOpen(false);
      setStatus(null);
      lastFetchRef.current = null;
      return;
    }
    const fetchKey = `${user.id}`;
    if (lastFetchRef.current === fetchKey) {
      // Já consultamos este user nesta montagem — não refetchar.
      return;
    }
    lastFetchRef.current = fetchKey;

    (async () => {
      try {
        const r = await fetch("/api/promotions/extra-gift", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (!r.ok) {
          setStatus(null);
          setOpen(false);
          return;
        }
        const data = (await r.json()) as ExtraGiftStatus;
        if (cancelled) return;
        setStatus(data);

        if (!data.enabled || !data.canClaim || data.leagues.length === 0) {
          setOpen(false);
          return;
        }
        if (readDismissed(data.dismissBundleKey)) {
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
  }, [isAdminRoute, ready, isLoggedIn, profileBlocksPromo, user?.id]);

  const handleOfferClose = useCallback(
    (permanent: boolean) => {
      if (permanent && status?.dismissBundleKey) {
        persistDismissed(status.dismissBundleKey);
      }
      stopAudio();
      setOpen(false);
    },
    [status?.dismissBundleKey, stopAudio],
  );

  const handleClaim = useCallback(async () => {
    // Trava com `useRef` é a defesa real contra duplo POST (state pode estar
    // batched). Mesmo se um segundo `handleClaim` for despachado milissegundos
    // depois, ele encontra o ref já travado e retorna sem ato.
    if (claimingRef.current) return;
    // Dispara o áudio AGORA — síncrono dentro do user gesture do click —
    // pra os navegadores não bloquearem por política de autoplay. Tem que
    // vir ANTES de qualquer `await`.
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
        return;
      }
      setClaimedTickets(data.tickets);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              alreadyClaimed: true,
              allClaimed: true,
              canClaim: false,
              ticketId: data.tickets![0]?.ticketId ?? prev.ticketId,
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
  }, [toast, playAudio]);

  const handlePlay = useCallback(() => {
    stopAudio();
    setOpen(false);
    // Força refresh do RSC de /boloes (cotas recém-resgatadas não entram no payload em cache).
    router.push("/boloes?fromExtraGift=1");
  }, [router, stopAudio]);

  const handleClaimedClose = useCallback(() => {
    stopAudio();
    setOpen(false);
  }, [stopAudio]);

  /** Dispara os confetes verdes quando o usuário entra no step "Bolões liberados".
   *  Burst central de partida + rajadas laterais durante ~1.6s. Cores derivadas
   *  do brand (#B1EB0B com tons claros + branco pra contraste). */
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

  /** Garantia: sempre que o modal fechar (por qualquer caminho, inclusive
   *  re-render do auth) o áudio para. Defesa em profundidade além dos
   *  closers explícitos. */
  useEffect(() => {
    if (!open) stopAudio();
  }, [open, stopAudio]);

  /** Cleanup completo no unmount — para playback e libera o AudioContext. */
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
            if (step === "offer") handleOfferClose(false);
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
              prizeLabel={status.prizeLabel}
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
