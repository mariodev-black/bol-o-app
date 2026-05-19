"use client";

/**
 * Modal "Brinde extra grátis por rodada" — exibido pós-login.
 *
 * Dois passos:
 *
 *   STEP 1 ("offer")   →  "Você ganhou o Bolão do Brasileirão da Xª rodada GRÁTIS".
 *                         Botão "RESGATAR ACESSO GRÁTIS" chama POST `/api/promotions/extra-gift`.
 *                         Checkbox "Não exibir isso novamente" persiste no localStorage
 *                         (chave por championship + rodada — reabre quando muda a rodada).
 *
 *   STEP 2 ("claimed") →  "BOLÃO LIBERADO!". Botão "FAZER MEUS PALPITES" leva para
 *                         `/palpites?ticket=<ticketId>` (entra direto no ticket recém-criado).
 *
 * Regras:
 *   - Aparece só quando `enabled && !alreadyClaimed && !dismissedForThisRound`.
 *   - Se o usuário fecha sem resgatar, o modal volta no próximo login a menos que
 *     marque "não exibir novamente".
 *   - O resgate é idempotente no backend — múltiplos clicks geram o mesmo ticket.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Trophy, X } from "lucide-react";
import { useAuth } from "@/app/shared/AuthContext";
import { useBolaoToast } from "@/app/components/BolaoToast";
import poupUpImage from "@/app/assets/poup-up.jpeg";

const PROMO_FONT = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";
/** localStorage prefix — sufixo `_{championshipId}_{rodada}` para isolar por rodada. */
const DISMISS_PREFIX = "bolao_extra_gift_dismissed_v1";

type ExtraGiftStatus = {
  enabled: boolean;
  championshipId: number | null;
  rodada: number | null;
  rodadaNome: string | null;
  championshipName: string | null;
  alreadyClaimed: boolean;
  ticketId: string | null;
  displayName: string;
  prizeLabel: string;
};

type Step = "offer" | "claimed";

function dismissKey(championshipId: number, rodada: number): string {
  return `${DISMISS_PREFIX}:${championshipId}:${rodada}`;
}

function readDismissed(championshipId: number, rodada: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(dismissKey(championshipId, rodada)) === "1";
  } catch {
    return false;
  }
}

function persistDismissed(championshipId: number, rodada: number): void {
  try {
    window.localStorage.setItem(dismissKey(championshipId, rodada), "1");
  } catch {
    /* localStorage indisponível — sem-op (modal volta no próximo login). */
  }
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
  const bonusName = status.displayName;
  const rodadaLabel = status.rodadaNome ?? (status.rodada != null ? `${status.rodada}ª rodada` : "");

  const handleClose = () => onClose(dontShowAgain);

  return (
    // Wrapper externo: relativo + padding-top que reserva espaço pra a imagem
    // "vazar" acima do topo do card. A imagem fica em z-0 (fundo) — a metade
    // de cima dela aparece nos `pt-[140px]` reservados, a metade de baixo
    // fica naturalmente OCULTA atrás do card opaco (z-10).
    <div
      className="relative w-full max-w-[380px] pt-[140px]"
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Imagem do mascote — camada de fundo (z-0). O card opaco em z-10 cobre
          o que estiver dentro da área dele, criando o efeito de "vazar". */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 flex justify-center"
        aria-hidden
      >
        <Image
          src={poupUpImage}
          alt=""
          width={1024}
          height={768}
          priority
          draggable={false}
          className="h-auto w-[78%] max-w-[300px] select-none drop-shadow-[0_14px_24px_rgba(0,0,0,0.55)]"
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
        className="relative z-10 rounded-3xl border-2 border-primary bg-black px-6 pb-6 pt-8 shadow-[0_0_40px_rgba(177,235,11,0.22)]"
        id="extra-gift-promo-card"
      >
        {/* Título */}
        <h2
          id="extra-gift-promo-title"
          className="text-center text-[26px] font-black uppercase leading-[1.02] tracking-tight text-primary sm:text-[28px]"
          style={{ textShadow: "0 0 18px rgba(177,235,11,0.28)" }}
        >
          Você ganhou um
          <br />
          bolão grátis!
        </h2>

        {/* Subtítulo */}
        <p className="mx-auto mt-4 max-w-[290px] text-center text-[12px] font-bold uppercase leading-[1.45] tracking-[0.02em] text-white/85 sm:text-[12.5px]">
          Participe do {bonusName}
          {rodadaLabel ? (
            <>
              {" "}da{" "}
              <span className="text-primary">{rodadaLabel}</span>
            </>
          ) : null}{" "}
          valendo{" "}
          <span className="text-primary">{status.prizeLabel}</span>{" "}
          em prêmios.
        </p>

        {/* Chamada */}
        <p className="mt-3 text-center text-[12px] font-semibold uppercase leading-snug tracking-wide text-white/65">
          Entre agora e já começa palpitando!
        </p>

        {/* CTA pill */}
        <button
          type="button"
          disabled={loading}
          onClick={onClaim}
          className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-full bg-primary px-4 text-[14px] font-black uppercase tracking-wide text-[#0E141B] shadow-[0_8px_28px_rgba(177,235,11,0.42)] transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-70 sm:text-[15px]"
        >
          {loading ? "Resgatando..." : "Resgatar acesso grátis"}
        </button>

        {/* Checkbox discreto */}
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="size-3.5 shrink-0 accent-[#B1EB0B]"
          />
          <span className="text-[11.5px] font-semibold leading-snug text-white/60">
            Não exibir isso novamente
          </span>
        </label>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  STEP 2 — Confirmação (Bolão liberado)                                      */
/* -------------------------------------------------------------------------- */

function ClaimedStep({
  status,
  onPlay,
  onClose,
}: {
  status: ExtraGiftStatus;
  onPlay: () => void;
  onClose: () => void;
}) {
  const rodadaLabel = status.rodadaNome ?? (status.rodada != null ? `${status.rodada}ª rodada` : "");

  return (
    <div
      className="relative w-full max-w-[380px] overflow-hidden rounded-3xl border-2 border-primary bg-black shadow-[0_0_40px_rgba(177,235,11,0.25)]"
      style={{ fontFamily: PROMO_FONT }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <X className="size-4" strokeWidth={2.5} aria-hidden />
      </button>

      {/* Ícone de check em destaque */}
      <header className="px-5 pb-3 pt-12 text-center">
        <div
          className="relative mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary"
          aria-hidden
          style={{ boxShadow: "0 0 40px rgba(177,235,11,0.4)" }}
        >
          <Check className="size-12 text-primary" strokeWidth={2.4} />
        </div>

        <h2 id="extra-gift-claimed-title" className="leading-[1.05] tracking-tight">
          <span className="block text-[28px] font-black uppercase text-white sm:text-[30px]">
            Bolão
          </span>
          <span
            className="mt-0.5 block text-[28px] font-black uppercase text-primary sm:text-[30px]"
            style={{ textShadow: "0 0 22px rgba(177,235,11,0.4)" }}
          >
            Liberado!
          </span>
        </h2>

        <p className="mx-auto mt-4 max-w-[280px] text-[14px] font-medium leading-snug text-white/85 sm:text-[15px]">
          Você já pode enviar seus palpites
          {rodadaLabel ? (
            <>
              {" "}da{" "}
              <span className="font-black text-primary">{rodadaLabel}</span>.
            </>
          ) : (
            "."
          )}
        </p>
      </header>

      {/* Card "PREMIAÇÃO" */}
      <div className="mx-4 mt-5 rounded-2xl border border-white/12 bg-[#161616] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40"
            aria-hidden
          >
            <Trophy
              className="size-7 text-primary"
              strokeWidth={2.1}
              style={{ filter: "drop-shadow(0 0 8px rgba(177,235,11,0.55))" }}
            />
          </span>
          <div className="flex flex-1 flex-col">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
              Premiação
            </span>
            <span className="mt-0.5 text-[20px] font-black leading-none text-white">
              {status.prizeLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 pt-5">
        <button
          type="button"
          onClick={onPlay}
          className="relative flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-black uppercase tracking-wide text-[#0E141B] shadow-[0_6px_28px_rgba(177,235,11,0.4)] transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-[16px]"
        >
          <span>Fazer meus palpites</span>
          <ArrowRight className="size-5" strokeWidth={2.6} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Host                                                                       */
/* -------------------------------------------------------------------------- */

export function ExtraGiftPromoHost({ children }: { children: React.ReactNode }) {
  const { ready, isLoggedIn, user } = useAuth();
  const router = useRouter();
  const toast = useBolaoToast();

  const [status, setStatus] = useState<ExtraGiftStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("offer");
  const [claiming, setClaiming] = useState(false);

  /** Última combinação user+championship+rodada já consultada — evita refetch
   *  redundante (ex: re-renders do AuthContext em StrictMode). */
  const lastFetchRef = useRef<string | null>(null);
  /** Trava de claim independente do state — imune a strict mode / double click
   *  rapidíssimos onde dois eventos podem ser despachados antes de qualquer
   *  rerender consumir o `claiming=true`. */
  const claimingRef = useRef(false);

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
    if (!ready || !isLoggedIn || profileBlocksPromo || !user?.id) {
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

        if (!data.enabled || data.championshipId == null || data.rodada == null) {
          setOpen(false);
          return;
        }
        if (data.alreadyClaimed) {
          // Já resgatou esta rodada — não mostra de novo.
          setOpen(false);
          return;
        }
        if (readDismissed(data.championshipId, data.rodada)) {
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
  }, [ready, isLoggedIn, profileBlocksPromo, user?.id]);

  const handleOfferClose = useCallback(
    (permanent: boolean) => {
      if (permanent && status?.championshipId != null && status.rodada != null) {
        persistDismissed(status.championshipId, status.rodada);
      }
      setOpen(false);
    },
    [status?.championshipId, status?.rodada],
  );

  const handleClaim = useCallback(async () => {
    // Trava com `useRef` é a defesa real contra duplo POST (state pode estar
    // batched). Mesmo se um segundo `handleClaim` for despachado milissegundos
    // depois, ele encontra o ref já travado e retorna sem ato.
    if (claimingRef.current) return;
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
        ticketId?: string;
        championshipId?: number;
        rodada?: number;
        alreadyClaimed?: boolean;
        error?: string;
      };
      if (!r.ok || !data.ok || !data.ticketId) {
        toast.error(data.error ?? "Não foi possível resgatar o brinde agora.");
        return;
      }
      // `alreadyClaimed=true` é um sucesso legítimo: outra aba/device já tinha
      // resgatado e o backend devolveu o ticket existente. Tratamos igual ao
      // claim novo — usuário vê o step 2 "Bolão liberado" sem dúvida.
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              alreadyClaimed: true,
              ticketId: data.ticketId ?? prev.ticketId,
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
  }, [toast]);

  const handlePlay = useCallback(() => {
    setOpen(false);
    const ticketId = status?.ticketId;
    // `/palpites?ticket=<id>` é a URL canônica para entrar direto no ticket
    // específico — `app/(authenticated)/palpites/page.tsx` resolve o tid via
    // searchParams e injeta no initialData do client.
    if (ticketId) {
      router.push(`/palpites?ticket=${encodeURIComponent(ticketId)}`);
    } else {
      router.push("/palpites");
    }
  }, [router, status?.ticketId]);

  const handleClaimedClose = useCallback(() => {
    setOpen(false);
  }, []);

  const showModal = open && status != null;

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
            <ClaimedStep status={status} onPlay={handlePlay} onClose={handleClaimedClose} />
          )}
        </div>
      ) : null}
    </>
  );
}
