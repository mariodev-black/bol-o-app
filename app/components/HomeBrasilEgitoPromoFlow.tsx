"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/shared/AuthContext";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { useHomeAuthModal } from "@/app/shared/HomeAuthModalContext";
import { useMainBolaoPromoModal } from "@/app/shared/MainBolaoPromoContext";
import {
  OfferStep,
  SignupPromptModal,
  SuccessStep,
} from "@/app/shared/BrasilEgitoPlacarPromoHost";
import type { BrasilEgitoPlacarPromoStatus } from "@/lib/promotions/brasil-egito-placar-promo";
import {
  HOME_PROMO_FLOW_PATH,
  clearBrasilEgitoGuestFlowActive,
  clearPendingBrasilEgitoPalpite,
  isBrasilEgitoGuestFlowActive,
  isBrasilEgitoPalpiteFinalized,
  markBrasilEgitoGuestFlowActive,
  markBrasilEgitoPalpiteFinalized,
  persistBrasilEgitoReferralModalDismissed,
  readBrasilEgitoReferralModalDismissed,
  resolvePendingBrasilEgitoPalpite,
  stripBrasilEgitoPalpiteSearchParams,
  writePendingBrasilEgitoPalpite,
} from "@/lib/promotions/brasil-egito-guest-flow";
import { readMainBolaoPromoModalDismissed } from "@/lib/promotions/main-bolao-promo";

const PROMO_Z = 157;
const LOADING_Z = 158;
const API_PATH = "/api/promotions/brasil-egito-placar";
const SIGNUP_TRANSITION_MS = 2000;

type FlowStep = "offer" | "signup" | "success";

type HomeBrasilEgitoPromoFlowProps = {
  friendsGoal: number;
  promoEnabled: boolean;
};

function PromoTransitionModal({ message }: { message: string }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      style={{ zIndex: LOADING_Z }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="w-full max-w-[300px] rounded-4xl border border-white/10 bg-[#141414] px-6 py-8 text-center shadow-[0_24px_48px_rgba(0,0,0,0.65)]"
        onClick={(e) => e.stopPropagation()}
      >
        <Loader2
          className="mx-auto size-10 animate-spin text-primary"
          strokeWidth={2}
          aria-hidden
        />
        <p className="mt-4 text-[14px] font-semibold leading-snug text-white/85">
          {message}
        </p>
      </div>
    </div>
  );
}

function statusMatchesPalpite(
  status: BrasilEgitoPlacarPromoStatus,
  predCasa: number,
  predVisitante: number,
): boolean {
  return (
    status.predCasa === predCasa && status.predVisitante === predVisitante
  );
}

function isAlreadySubmittedPromoError(error?: string): boolean {
  const msg = String(error ?? "").toLowerCase();
  return (
    msg.includes("já enviou") ||
    msg.includes("ja enviou") ||
    msg.includes("já palpitou") ||
    msg.includes("ja palpitou")
  );
}

/** Palpite promo já salvo ou palpite pago neste jogo no bolão. */
function hasPromoPalpiteDone(
  status: BrasilEgitoPlacarPromoStatus | null | undefined,
): status is BrasilEgitoPlacarPromoStatus {
  if (!status) return false;
  return status.alreadySubmitted || status.hasBet;
}

export function HomeBrasilEgitoPromoFlow({
  friendsGoal,
  promoEnabled,
}: HomeBrasilEgitoPromoFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useBolaoToast();
  const { openCadastro } = useHomeAuthModal();
  const { requestModal } = useMainBolaoPromoModal();
  const { ready, isLoggedIn, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>("offer");
  const [status, setStatus] = useState<BrasilEgitoPlacarPromoStatus | null>(
    null,
  );
  const [predCasa, setPredCasa] = useState(0);
  const [predVisitante, setPredVisitante] = useState(0);
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState(
    "Preparando seu cadastro...",
  );
  const [submitting, setSubmitting] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const guestAutoOpenedRef = useRef(false);
  const finalizeInFlightRef = useRef(false);
  const authFinalizeAttemptedRef = useRef(false);
  const loggedInFlowStartedRef = useRef(false);
  const continuationAfterReferralRef = useRef(false);
  const signupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPromoStatus =
    useCallback(async (): Promise<BrasilEgitoPlacarPromoStatus | null> => {
      const r = await fetch(API_PATH, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) return null;
      return (await r.json()) as BrasilEgitoPlacarPromoStatus;
    }, []);

  const stripPalpiteQueryFromUrl = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (!stripBrasilEgitoPalpiteSearchParams(next)) return;
    const q = next.toString();
    router.replace(q ? `${HOME_PROMO_FLOW_PATH}?${q}` : HOME_PROMO_FLOW_PATH, {
      scroll: false,
    });
  }, [router, searchParams]);

  const buildGuestStatus = useCallback(
    (): BrasilEgitoPlacarPromoStatus => ({
      enabled: true,
      showOfferModal: true,
      hasBet: false,
      alreadySubmitted: false,
      referralCode: "",
      signupLink: "",
      friendsInvited: 0,
      friendsGoal,
      predCasa: null,
      predVisitante: null,
    }),
    [friendsGoal],
  );

  useEffect(() => {
    setPortalReady(true);
    return () => {
      if (signupTimerRef.current) clearTimeout(signupTimerRef.current);
    };
  }, []);

  const submitPalpite = useCallback(
    async (
      casa: number,
      visitante: number,
      options?: { silent?: boolean },
    ): Promise<BrasilEgitoPlacarPromoStatus | null> => {
      const r = await fetch(API_PATH, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ predCasa: casa, predVisitante: visitante }),
      });
      const data = (await r
        .json()
        .catch(() => ({}))) as BrasilEgitoPlacarPromoStatus & { error?: string };
      if (!r.ok) {
        if (r.status === 409 && isAlreadySubmittedPromoError(data.error)) {
          const existing = await fetchPromoStatus();
          if (hasPromoPalpiteDone(existing)) return existing;
        }
        if (!options?.silent) {
          toast.error(data.error ?? "Não foi possível salvar o palpite.");
        }
        return null;
      }
      if (!statusMatchesPalpite(data, casa, visitante)) {
        if (!options?.silent) {
          toast.error(
            "Palpite salvo com placar diferente do informado. Tente novamente.",
          );
        }
        return null;
      }
      return data;
    },
    [toast, fetchPromoStatus],
  );

  /** Limpa storage/URL — sem modal, sem toast, sem POST. */
  const silentDismissPromoFlow = useCallback(() => {
    markBrasilEgitoPalpiteFinalized(user?.id);
    clearPendingBrasilEgitoPalpite();
    clearBrasilEgitoGuestFlowActive();
    stripPalpiteQueryFromUrl();
    setTransitionLoading(false);
    setOpen(false);
  }, [stripPalpiteQueryFromUrl, user?.id]);

  const openOffer = useCallback(
    (scores?: { predCasa: number; predVisitante: number }) => {
      const casa = scores?.predCasa ?? predCasa;
      const visitante = scores?.predVisitante ?? predVisitante;
      setPredCasa(casa);
      setPredVisitante(visitante);
      setStep("offer");
      setStatus(buildGuestStatus());
      setOpen(true);
    },
    [buildGuestStatus, predCasa, predVisitante],
  );

  const continueAfterReferral = useCallback(() => {
    if (continuationAfterReferralRef.current) return;
    continuationAfterReferralRef.current = true;
    persistBrasilEgitoReferralModalDismissed(user?.id);
    setOpen(false);
    setTransitionLoading(false);
    clearBrasilEgitoGuestFlowActive();
    if (readMainBolaoPromoModalDismissed(user?.id)) return;
    requestModal({ once: true });
  }, [requestModal, user?.id]);

  const openSuccess = useCallback(
    (
      data: BrasilEgitoPlacarPromoStatus,
      scores: { predCasa: number; predVisitante: number },
    ) => {
      markBrasilEgitoPalpiteFinalized(user?.id);
      clearPendingBrasilEgitoPalpite();
      stripPalpiteQueryFromUrl();
      setPredCasa(scores.predCasa);
      setPredVisitante(scores.predVisitante);
      setStatus(data);
      setTransitionLoading(false);
      if (readBrasilEgitoReferralModalDismissed(user?.id)) {
        continueAfterReferral();
        return;
      }
      setStep("success");
      setOpen(true);
    },
    [stripPalpiteQueryFromUrl, continueAfterReferral, user?.id],
  );

  /** Após cadastro: GET → se já fez, dismiss; senão POST uma vez e success. */
  const savePendingPalpiteAfterAuth = useCallback(
    async (pending: { predCasa: number; predVisitante: number }) => {
      if (finalizeInFlightRef.current) return;
      finalizeInFlightRef.current = true;

      try {
        const existing = await fetchPromoStatus();
        if (hasPromoPalpiteDone(existing)) {
          silentDismissPromoFlow();
          return;
        }

        setTransitionMessage("Registrando seu palpite...");
        setTransitionLoading(true);
        setPredCasa(pending.predCasa);
        setPredVisitante(pending.predVisitante);

        const data = await submitPalpite(
          pending.predCasa,
          pending.predVisitante,
          { silent: true },
        );

        if (!data) {
          const fallback = await fetchPromoStatus();
          if (hasPromoPalpiteDone(fallback)) {
            silentDismissPromoFlow();
            return;
          }
          toast.error(
            "Não foi possível registrar seu palpite. Tente salvar novamente.",
          );
          authFinalizeAttemptedRef.current = false;
          return;
        }

        if (data.hasBet && !data.alreadySubmitted) {
          silentDismissPromoFlow();
          return;
        }

        setTransitionLoading(false);
        openSuccess(data, pending);
      } catch {
        toast.error("Erro de rede. Tente novamente.");
        authFinalizeAttemptedRef.current = false;
      } finally {
        finalizeInFlightRef.current = false;
        setTransitionLoading(false);
      }
    },
    [
      submitPalpite,
      openSuccess,
      silentDismissPromoFlow,
      fetchPromoStatus,
      toast,
    ],
  );

  useEffect(() => {
    if (!promoEnabled || !ready || isLoggedIn) return;

    const pending = resolvePendingBrasilEgitoPalpite(searchParams);
    const guestFlowIntent =
      pending != null || isBrasilEgitoGuestFlowActive();
    if (!guestFlowIntent) return;

    if (guestAutoOpenedRef.current) return;
    guestAutoOpenedRef.current = true;
    setStep("offer");
    openOffer(pending ?? undefined);
  }, [promoEnabled, ready, isLoggedIn, searchParams, openOffer]);

  useEffect(() => {
    if (!promoEnabled || !ready || !isLoggedIn || !user?.id) return;
    if (loggedInFlowStartedRef.current) return;
    loggedInFlowStartedRef.current = true;

    void (async () => {
      const serverStatus = await fetchPromoStatus();

      if (hasPromoPalpiteDone(serverStatus)) {
        silentDismissPromoFlow();
        return;
      }

      const pending = resolvePendingBrasilEgitoPalpite(searchParams, user.id);
      if (!pending) return;

      if (authFinalizeAttemptedRef.current || finalizeInFlightRef.current) return;
      authFinalizeAttemptedRef.current = true;
      await savePendingPalpiteAfterAuth(pending);
    })();
  }, [
    promoEnabled,
    ready,
    isLoggedIn,
    user?.id,
    searchParams,
    savePendingPalpiteAfterAuth,
    silentDismissPromoFlow,
    fetchPromoStatus,
  ]);

  const handleClose = useCallback(() => {
    if (signupTimerRef.current) {
      clearTimeout(signupTimerRef.current);
      signupTimerRef.current = null;
    }
    setTransitionLoading(false);
    if (step === "success") {
      continueAfterReferral();
      return;
    }
    if (step === "signup" || step === "offer") {
      clearBrasilEgitoGuestFlowActive();
    }
    setOpen(false);
  }, [continueAfterReferral, step]);

  const handleGuestSave = useCallback(() => {
    writePendingBrasilEgitoPalpite(predCasa, predVisitante);
    markBrasilEgitoGuestFlowActive();
    setTransitionMessage("Salvando seu palpite...");
    setTransitionLoading(true);

    if (signupTimerRef.current) clearTimeout(signupTimerRef.current);
    signupTimerRef.current = setTimeout(() => {
      signupTimerRef.current = null;
      setStep("signup");
      setTransitionLoading(false);
    }, SIGNUP_TRANSITION_MS);
  }, [predCasa, predVisitante]);

  const handleCreateAccount = useCallback(() => {
    writePendingBrasilEgitoPalpite(predCasa, predVisitante);
    markBrasilEgitoGuestFlowActive();
    openCadastro(HOME_PROMO_FLOW_PATH);
  }, [openCadastro, predCasa, predVisitante]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!promoEnabled) return null;
  if (
    isLoggedIn &&
    !open &&
    !transitionLoading &&
    (isBrasilEgitoPalpiteFinalized(user?.id) ||
      !resolvePendingBrasilEgitoPalpite(searchParams, user?.id))
  ) {
    return null;
  }

  const showContentModal =
    open &&
    status != null &&
    portalReady &&
    !transitionLoading &&
    (!isLoggedIn || step === "success");
  const showTransitionModal = transitionLoading && portalReady;

  const portals = (
    <>
      {showTransitionModal
        ? createPortal(
            <PromoTransitionModal message={transitionMessage} />,
            document.body,
          )
        : null}
      {showContentModal
        ? createPortal(
            <div
              className="fixed inset-0 flex max-h-dvh items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-[2px]"
              style={{ zIndex: PROMO_Z }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={
                step === "signup"
                  ? "brasil-egito-signup-prompt-title"
                  : step === "offer"
                    ? "brasil-egito-placar-promo-title"
                    : "brasil-egito-placar-success-title"
              }
              onClick={step === "signup" ? undefined : handleClose}
            >
              <div className="my-auto flex w-full justify-center py-2">
                {step === "offer" ? (
                  <OfferStep
                    predCasa={predCasa}
                    predVisitante={predVisitante}
                    onPredCasaChange={setPredCasa}
                    onPredVisitanteChange={setPredVisitante}
                    loading={submitting}
                    onSubmit={handleGuestSave}
                    onClose={handleClose}
                    friendsGoal={status.friendsGoal}
                  />
                ) : step === "signup" ? (
                  <SignupPromptModal
                    onCreateAccount={handleCreateAccount}
                  />
                ) : (
                  <SuccessStep
                    predCasa={status.predCasa ?? predCasa}
                    predVisitante={status.predVisitante ?? predVisitante}
                    signupLink={status.signupLink}
                    friendsInvited={status.friendsInvited}
                    friendsGoal={status.friendsGoal}
                    onClose={handleClose}
                  />
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );

  return portalReady ? portals : null;
}
