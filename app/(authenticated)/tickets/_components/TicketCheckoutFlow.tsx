"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Lock,
  Percent,
  Shield,
  ShoppingCart,
  Tags,
  Ticket,
  Trophy,
  Wallet,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import bannerCheckout from "@/app/assets/banner-chekout.png";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import ticketGold from "@/app/assets/ticket-gold.png";
import { isCopaDoBrasilChampionshipTitle } from "@/lib/boloes-copa-brasil-branding";
import { championshipCountsFromExtraQuantity } from "@/lib/payments/ticket-config";
import { appendTicketsFromPurchase } from "../lib/ownedTicketsStorage";
import { TicketPixGeneratedScreen } from "./pix/TicketPixGeneratedScreen";
import { TicketPixGeneratingPanel } from "./pix/TicketPixGeneratingPanel";
import {
  PIX_CHECKOUT_TOTAL_SEC,
  PIX_CHECKOUT_WINDOW_MS,
} from "./pix/ticket-pix-ui-constants";

const DEFAULT_PRINCIPAL_CENTS = 3990;
const DEFAULT_DIARIO_CENTS = 2000;
const DEFAULT_EXTRA_CENTS = 1000;

/** Mesmo espírito de `BOLOES_EXTRA_*` — permite cards no primeiro paint antes do GET (opcional). */
function parseNextPublicExtraChampionshipIds(): number[] {
  const raw =
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BOLOES_EXTRA_CHAMPIONSHIP_IDS : "") ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_BOLOES_EXTRA : "") ||
    "";
  if (!String(raw).trim()) return [];
  return String(raw)
    .split(/[,;\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

type ExtraBolaoOption = {
  championshipId: number;
  unitCents: number;
  displayName?: string;
  /** Data da rodada em aberto (dd/MM/yyyy), do servidor — mesma regra do bolão extra. */
  roundPlayDateBR?: string;
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function isPaidStatus(s: string): boolean {
  const v = (s || "").toLowerCase().trim();
  return (
    v === "paid" ||
    v === "approved" ||
    v === "success" ||
    v === "completed" ||
    v === "confirmed"
  );
}

function progressiveDiscountPercent(quantity: number): number {
  if (quantity >= 4) return 15;
  if (quantity === 3) return 10;
  if (quantity === 2) return 5;
  return 0;
}

function progressiveDiscountTotalCents(unitCents: number, quantity: number): number {
  if (quantity <= 0) return 0;
  const subtotal = unitCents * quantity;
  return Math.round((subtotal * (100 - progressiveDiscountPercent(quantity))) / 100);
}

type FlowStep = "shop" | "generating" | "pix";
type TicketType = "general" | "daily";

type DepositTransaction = {
  id: string;
  status: string;
  amountCents: number;
  ticketType: TicketType;
  pixQrcode: string | null;
  providerTransactionId: string | null;
  createdAt: string;
};

type TransactionUpdatePayload = {
  status?: string;
  pixQrcode?: string | null;
  providerTransactionId?: string | null;
};

type TicketCheckoutFlowProps = {
  initialTicketKind?: "general" | "daily" | "extra";
  /** Com `initialTicketKind === "extra"`, pré-seleciona este campeonato (id da API). */
  initialExtraChampionshipId?: number;
  /** IDs extras vindos do servidor — alinhados a `BOLOES_EXTRA_*`. */
  serverExtraChampionshipIds?: number[];
  /**
   * Quando true (env `TICKETS_EXTRA_ONLY`): oculta bolão geral e bolão do dia na loja;
   * só exibe a compra de bolões extra.
   */
  ticketsExtraOnly?: boolean;
};

const MAX_QTY = 20;

export function TicketCheckoutFlow({
  initialTicketKind = "general",
  initialExtraChampionshipId: _initialExtraChampionshipId,
  serverExtraChampionshipIds = [],
  ticketsExtraOnly = false,
}: TicketCheckoutFlowProps) {
  const router = useRouter();
  const [principalQty, setPrincipalQty] = useState(() => {
    if (ticketsExtraOnly) return 0;
    return initialTicketKind === "daily" || initialTicketKind === "extra" ? 0 : 1;
  });
  const [dailyQty, setDailyQty] = useState(() => {
    if (ticketsExtraOnly) return 0;
    return initialTicketKind === "daily" ? 1 : 0;
  });
  const [extraBoloes, setExtraBoloes] = useState<ExtraBolaoOption[]>(() => {
    const fromServer = (serverExtraChampionshipIds ?? []).filter((n) => Number.isFinite(n) && n > 0);
    const fromPublic = parseNextPublicExtraChampionshipIds();
    const ids = [...new Set([...fromServer, ...fromPublic])];
    return ids.map((championshipId) => ({
      championshipId,
      unitCents: DEFAULT_EXTRA_CENTS,
    }));
  });
  const [extraQuantity, setExtraQuantity] = useState(() => {
    if (ticketsExtraOnly) return initialTicketKind === "extra" ? 1 : 0;
    return initialTicketKind === "extra" ? 1 : 0;
  });
  const [prices, setPrices] = useState({
    general: DEFAULT_PRINCIPAL_CENTS,
    daily: DEFAULT_DIARIO_CENTS,
    extra: DEFAULT_EXTRA_CENTS,
  });
  const [step, setStep] = useState<FlowStep>("shop");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState("");
  const [pixDeadline, setPixDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponHint, setCouponHint] = useState<string | null>(null);
  const [checkingManually, setCheckingManually] = useState(false);
  const [confirmedPaid, setConfirmedPaid] = useState(false);
  const paidHandledRef = useRef(false);
  const purchasePrincipalRef = useRef(0);
  const purchaseDiarioRef = useRef(0);
  const purchaseExtraRef = useRef<Record<number, number>>({});

  useEffect(() => {
    if (!ticketsExtraOnly) return;
    setPrincipalQty(0);
    setDailyQty(0);
  }, [ticketsExtraOnly]);

  const handleTransactionUpdate = useCallback(
    (payload: TransactionUpdatePayload, source?: string) => {
      if (payload.status) {
        console.log("[PIX] status update", {
          source,
          status: payload.status,
          transactionId,
        });
      }
      if (payload.pixQrcode) setPixPayload(payload.pixQrcode);

      if (
        transactionId &&
        payload.status &&
        isPaidStatus(payload.status) &&
        !paidHandledRef.current
      ) {
        console.log("[PIX] PAGAMENTO CONFIRMADO — redirecionando", {
          source,
          status: payload.status,
        });
        paidHandledRef.current = true;
        setConfirmedPaid(true);
        appendTicketsFromPurchase(
          purchasePrincipalRef.current,
          purchaseDiarioRef.current,
          purchaseExtraRef.current,
        );
        const q = new URLSearchParams({
          tx: transactionId,
          principal: String(purchasePrincipalRef.current),
          diario: String(purchaseDiarioRef.current),
        });
        const extraTotal = Object.values(purchaseExtraRef.current).reduce((s, n) => s + n, 0);
        if (extraTotal > 0) q.set("extra", String(extraTotal));
        // Pequeno delay para o usuário ver o feedback "Pagamento confirmado!"
        window.setTimeout(() => {
          router.replace(`/tickets/obrigado?${q.toString()}`);
        }, 1500);
      }
    },
    [router, transactionId],
  );

  useEffect(() => {
    if (step === "generating" || step === "pix") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [step]);

  useEffect(() => {
    if (step !== "pix") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [step]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/deposits/transactions", {
          credentials: "include",
        });
        const d = (await r.json()) as {
          prices?: { general: number; daily: number; extra?: number };
          extraBoloes?: Array<{
            championshipId: number;
            unitCents: number;
            displayName?: string;
            roundPlayDateBR?: string;
          }>;
        };
        if (r.ok && d.prices) {
          setPrices({
            general: d.prices.general,
            daily: d.prices.daily,
            extra: d.prices.extra ?? DEFAULT_EXTRA_CENTS,
          });
        }
        if (r.ok && Array.isArray(d.extraBoloes) && d.extraBoloes.length > 0) {
          setExtraBoloes(d.extraBoloes);
        }
      } catch {
        // fallback nos valores default locais
      }
    })();
  }, []);

  // SSE — canal primário (funciona em dev; pode não funcionar em serverless multi-instância)
  useEffect(() => {
    if (step !== "pix" || !transactionId) return;
    console.log("[PIX] abrindo SSE para", transactionId);
    const es = new EventSource(
      `/api/deposits/transactions/${transactionId}/events`,
    );
    es.onopen = () => console.log("[PIX] SSE conectado");
    es.onerror = (e) => console.warn("[PIX] SSE erro", e);
    es.addEventListener("transaction", (evt) => {
      try {
        const payload = JSON.parse(
          (evt as MessageEvent).data,
        ) as TransactionUpdatePayload;
        handleTransactionUpdate(payload, "sse");
      } catch {
        console.warn("[PIX] SSE payload inválido", (evt as MessageEvent).data);
      }
    });
    return () => {
      console.log("[PIX] fechando SSE");
      es.close();
    };
  }, [step, transactionId, handleTransactionUpdate]);

  // Polling — canal de fallback (funciona sempre, inclusive em serverless)
  useEffect(() => {
    if (step !== "pix" || !transactionId) return;
    let cancelled = false;
    let pollCount = 0;

    async function pollTransaction() {
      if (paidHandledRef.current) return; // já redirecionando
      try {
        const r = await fetch(`/api/deposits/transactions/${transactionId}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await r.json()) as { transaction?: DepositTransaction };
        if (cancelled || !r.ok || !data.transaction) return;
        pollCount++;
        console.log("[PIX] poll #" + pollCount, data.transaction.status);
        handleTransactionUpdate(
          {
            status: data.transaction.status,
            pixQrcode: data.transaction.pixQrcode,
            providerTransactionId: data.transaction.providerTransactionId,
          },
          "poll",
        );
      } catch (err) {
        console.warn("[PIX] poll erro", err);
      }
    }

    // Poll imediato + intervalo de 2 s nos primeiros 30 s, depois 4 s
    void pollTransaction();
    let interval = 2000;
    let id = window.setInterval(() => {
      void pollTransaction();
    }, interval);

    const slowDown = window.setTimeout(() => {
      window.clearInterval(id);
      if (!cancelled && !paidHandledRef.current) {
        interval = 4000;
        id = window.setInterval(() => {
          void pollTransaction();
        }, interval);
      }
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(slowDown);
    };
  }, [step, transactionId, handleTransactionUpdate]);

  const extraPrimaryBolao = useMemo(() => {
    if (extraBoloes.length === 0) return undefined;
    if (_initialExtraChampionshipId != null) {
      const hit = extraBoloes.find((b) => b.championshipId === _initialExtraChampionshipId);
      if (hit) return hit;
    }
    return extraBoloes[0];
  }, [extraBoloes, _initialExtraChampionshipId]);

  const extraResumoShortLabel = useMemo(() => {
    const raw = extraPrimaryBolao?.displayName?.trim();
    if (raw) return raw;
    const names = extraBoloes.map((b) => b.displayName?.trim()).filter(Boolean);
    const uniq = [...new Set(names)];
    if (uniq.length === 1) return uniq[0]!;
    if (uniq.length > 1) return uniq.join(" · ");
    return "Bolão extra";
  }, [extraBoloes, extraPrimaryBolao]);

  const extraRoundPlayDateBR = useMemo(() => {
    const fromPrimary = extraPrimaryBolao?.roundPlayDateBR?.trim();
    if (fromPrimary) return fromPrimary;
    const first = extraBoloes.map((b) => b.roundPlayDateBR?.trim()).find(Boolean);
    return first ?? null;
  }, [extraBoloes, extraPrimaryBolao]);

  const extraTicketHeadline = useMemo(() => {
    const base = extraResumoShortLabel.trim();
    let headline =
      !base || base === "Bolão extra" ? "TICKET BOLÃO EXTRA" : `Bolão ${base.toUpperCase()}`;
    const d = extraRoundPlayDateBR?.trim();
    if (d) headline = `${headline} - ${d}`;
    return headline;
  }, [extraResumoShortLabel, extraRoundPlayDateBR]);

  const extraIconBadge = useMemo(() => {
    const s = extraResumoShortLabel.trim();
    if (!s || s === "Bolão extra") return "EXTRA";
    const first = (s.split(/\s+/)[0] ?? s).replace(/[^a-zA-ZÀ-ÿ0-9]/g, "");
    if (first.length <= 1) return s.slice(0, 10).toUpperCase();
    return first.length > 12 ? `${first.slice(0, 10)}…`.toUpperCase() : first.toUpperCase();
  }, [extraResumoShortLabel]);

  const extraNamesUnique = useMemo(
    () => [...new Set(extraBoloes.map((b) => b.displayName?.trim()).filter(Boolean))],
    [extraBoloes],
  );

  const extraCardUsesCopaBrasilIcon = useMemo(() => {
    const label = extraResumoShortLabel.trim();
    if (isCopaDoBrasilChampionshipTitle(label)) return true;
    return extraBoloes.some((b) => isCopaDoBrasilChampionshipTitle(b.displayName));
  }, [extraBoloes, extraResumoShortLabel]);

  const extraCardIconSrc = extraCardUsesCopaBrasilIcon ? iconCopaBrasil.src : ticketBlue.src;

  const principalLineCents = progressiveDiscountTotalCents(
    prices.general,
    principalQty,
  );
  const diarioLineCents = progressiveDiscountTotalCents(prices.daily, dailyQty);
  const extraLineCents = progressiveDiscountTotalCents(prices.extra, extraQuantity);
  const extraPixLines = useMemo(() => {
    if (extraQuantity <= 0) return [];
    return [
      {
        championshipId: extraPrimaryBolao?.championshipId ?? extraBoloes[0]?.championshipId ?? 0,
        qty: extraQuantity,
        lineCents: extraLineCents,
        displayLabel: `Ticket ${extraResumoShortLabel}`,
      },
    ];
  }, [extraBoloes, extraQuantity, extraLineCents, extraPrimaryBolao, extraResumoShortLabel]);

  const extraLinesCents = extraLineCents;
  const totalCents = principalLineCents + diarioLineCents + extraLinesCents;
  const totalQty = principalQty + dailyQty + extraQuantity;
  const hasSelection = totalCents > 0 && totalQty >= 1;
  const geralDiscountPct = progressiveDiscountPercent(principalQty);
  const diarioDiscountPct = progressiveDiscountPercent(dailyQty);
  const extraDiscountPct = progressiveDiscountPercent(extraQuantity);
  const principalUnitPriceCents =
    principalQty > 0 ? Math.round(principalLineCents / principalQty) : prices.general;
  const dailyUnitPriceCents =
    dailyQty > 0 ? Math.round(diarioLineCents / dailyQty) : prices.daily;
  const extraUnitPriceCents =
    extraQuantity > 0 ? Math.round(extraLineCents / extraQuantity) : prices.extra;
  const secondsLeft =
    step === "pix" && pixDeadline != null
      ? Math.max(0, Math.ceil((pixDeadline - now) / 1000))
      : 0;
  const pixExpired = step === "pix" && pixDeadline != null && secondsLeft === 0;
  const pixProgressPct =
    step === "pix" && pixDeadline != null
      ? Math.min(100, Math.max(0, (secondsLeft / PIX_CHECKOUT_TOTAL_SEC) * 100))
      : 0;

  const goGenerate = useCallback(() => {
    if (!hasSelection) return;
    setError(null);
    setCouponHint(null);
    setStep("generating");
    void (async () => {
      try {
        const r = await fetch("/api/deposits/transactions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generalQuantity: principalQty,
            dailyQuantity: dailyQty,
            extraQuantity,
          }),
        });
        const d = (await r.json()) as {
          error?: string;
          transaction?: DepositTransaction;
        };
        if (!r.ok || !d.transaction || !d.transaction.pixQrcode) {
          setError(d.error ?? "Nao foi possivel gerar o PIX.");
          setStep("shop");
          return;
        }
        purchasePrincipalRef.current = principalQty;
        purchaseDiarioRef.current = dailyQty;
        purchaseExtraRef.current = championshipCountsFromExtraQuantity(
          extraQuantity,
          extraBoloes.map((b) => b.championshipId),
        );
        setTransactionId(d.transaction.id);
        setPixPayload(d.transaction.pixQrcode);
        setPixDeadline(Date.now() + PIX_CHECKOUT_WINDOW_MS);
        setStep("pix");
      } catch {
        setError("Erro de rede ao gerar o PIX.");
        setStep("shop");
      }
    })();
  }, [hasSelection, principalQty, dailyQty, extraBoloes, extraQuantity]);

  const copyPix = useCallback(() => {
    if (!pixPayload || pixExpired) return;
    void navigator.clipboard.writeText(pixPayload);
  }, [pixPayload, pixExpired]);

  const goBackFromPix = useCallback(() => {
    setStep("shop");
    setPixPayload("");
    setTransactionId(null);
    setPixDeadline(null);
    setConfirmedPaid(false);
    paidHandledRef.current = false;
    setError(null);
  }, []);

  const handleVerifyPaidClick = useCallback(async () => {
    if (!transactionId || checkingManually) return;
    setCheckingManually(true);
    try {
      const r = await fetch(`/api/deposits/transactions/${transactionId}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await r.json()) as {
        transaction?: DepositTransaction;
      };
      if (r.ok && data.transaction) {
        console.log("[PIX] verificação manual status:", data.transaction.status);
        handleTransactionUpdate(
          {
            status: data.transaction.status,
            pixQrcode: data.transaction.pixQrcode,
          },
          "manual",
        );
        if (!isPaidStatus(data.transaction.status)) {
          setError("Pagamento ainda não confirmado. Aguarde ou tente novamente.");
          window.setTimeout(() => setError(null), 4000);
        }
      }
    } catch {
      setError("Erro ao verificar. Tente novamente.");
      window.setTimeout(() => setError(null), 3000);
    } finally {
      setCheckingManually(false);
    }
  }, [transactionId, checkingManually, handleTransactionUpdate]);

  return (
    <>
      {step === "shop" ? (
        <div className="min-h-screen w-full bg-black pb-10">
          <div className="relative w-full overflow-hidden rounded-b-[22px]">
            <Image
              src={bannerCheckout}
              alt="Checkout — Bolão do Milhão"
              className="h-auto w-full object-cover object-center"
              priority
              sizes="100vw"
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent"
              aria-hidden
            />
          </div>

          <div className="mx-auto w-full max-w-[430px] space-y-5 px-4 pt-5">
            {/* Faixa promocional — layout alinhado ao print (fundo preto, borda neon, divisor, coluna ATÉ/25%) */}
            <div
              className="flex items-stretch rounded-[14px] border border-primary bg-[#121212] px-3.5 py-3.5 sm:px-4 sm:py-4"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(177,235,11,0.35), 0 0 28px rgba(177,235,11,0.22), inset 0 0 32px rgba(177,235,11,0.04)",
              }}
            >
              {/* Esquerda: ícone + textos (como no print) */}
              <div className="flex min-w-0 flex-1 items-center gap-3 border-r border-primary/30 pr-3 sm:gap-3.5 sm:pr-4">
                <div className="relative size-11 shrink-0 sm:size-12">
                  <Tags
                    className="size-11 text-primary sm:size-12"
                    strokeWidth={2}
                    style={{
                      filter:
                        "drop-shadow(0 0 10px rgba(177,235,11,0.65)) drop-shadow(0 0 20px rgba(177,235,11,0.35))",
                    }}
                    aria-hidden
                  />
                  <Percent
                    className="pointer-events-none absolute left-[55%] top-1/2 size-[13px] -translate-x-1/2 -translate-y-1/2 text-primary sm:size-[14px]"
                    strokeWidth={3}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="text-[12px] font-black uppercase leading-tight tracking-wide text-white sm:text-[11px]">
                    ACIMA DE 2 TICKETS
                  </p>
                  <p
                    className="mt-1 text-[15px] font-black uppercase leading-[1.1] tracking-wide text-primary sm:text-[16px]"
                    style={{ textShadow: "0 0 18px rgba(177,235,11,0.45)" }}
                  >
                    DESCONTO PROGRESSIVO!
                  </p>
                  <p className="mt-1.5 text-[12px] font-normal leading-snug text-white sm:text-[11px]">
                    Quanto mais tickets, maior a sua chance de ganhar!
                </p>
              </div>
              </div>

              {/* Direita: ATÉ / 25% / badge */}
              <div className="flex w-[80px] shrink-0 flex-col items-center justify-center self-center pl-3 text-center sm:w-[84px]">
                <p className="text-[12px] font-black uppercase tracking-wide text-white sm:text-[11px]">ATÉ</p>
                <p
                  className="mt-0.5 text-[34px] font-black leading-none tracking-tight text-primary sm:text-[38px]"
                  style={{ textShadow: "0 0 22px rgba(177,235,11,0.5)" }}
                >
                  15%
                </p>
                <span
                  className="mt-2 w-full min-w-full bg-primary px-2 py-1 text-[8px] font-black uppercase flex justify-center items-center leading-tight tracking-wide text-black sm:text-[9px] text-center whitespace-nowrap"
                style={{
                    clipPath: "polygon(3% 0, 97% 0, 100% 18%, 100% 82%, 97% 100%, 3% 100%, 0 82%, 0 18%)",
                }}
              >
                  DE DESCONTO
                  </span>
              </div>
                </div>

            <div className="space-y-3">
              {!ticketsExtraOnly && (
                <>
              {/* Card Bolão Geral */}
              <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#121212] shadow-[0_8px_26px_rgba(0,0,0,0.35)]">
                <div className="grid grid-cols-[74px_minmax(0,1fr)] items-center gap-3 p-3 sm:grid-cols-[86px_minmax(0,1fr)] sm:p-3.5">
                  <div className="flex flex-col items-center justify-center">
                    <img
                      src={ticketGold.src}
                      alt=""
                      className="h-[72px] w-[52px] shrink-0 object-contain drop-shadow-[0_8px_24px_rgba(177,235,11,0.35)] sm:h-[86px] sm:w-[62px]"
                    />
                    <span className="mt-1 text-[8px] font-black uppercase leading-tight tracking-wide text-primary">
                      Copa 2026
                    </span>
                  </div>

                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
                    <div className="min-w-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="whitespace-nowrap text-[14px] font-black uppercase leading-tight text-white sm:text-[15px]">
                            Bolão do Milhão
                          </h3>
                          <span className="w-fit shrink-0 rounded-md bg-primary/20 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-primary sm:text-[8px]">
                            Mais popular
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] font-medium leading-snug text-white/80 sm:text-[11px]">
                          Acesso a todas as rodadas da Copa do Mundo 2026
                        </p>
                      </div>

                    <div className="mt-3 flex w-fit items-center gap-1 rounded-[10px] border border-white/10 bg-[#0f0f0f] p-1">
                      <button
                        type="button"
                        aria-label="Diminuir Bolão Geral"
                        disabled={principalQty <= 0}
                        onClick={() => {
                          setError(null);
                          setCouponHint(null);
                          setPrincipalQty((q) => Math.max(0, q - 1));
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/20 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                      >
                        <span className="text-[18px] font-black leading-none">-</span>
                      </button>
                      <span className="w-8 text-center text-[18px] font-black tabular-nums text-white sm:text-[20px]">
                        {principalQty}
                      </span>
                      <button
                        type="button"
                        aria-label="Aumentar Bolão Geral"
                        disabled={principalQty >= MAX_QTY}
                        onClick={() => {
                          setError(null);
                          setCouponHint(null);
                          setPrincipalQty((q) => Math.min(MAX_QTY, q + 1));
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/30 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                      >
                        <span className="text-[18px] font-black leading-none">+</span>
                      </button>
                    </div>
                  </div>

                    <div className="self-center text-right">
                      <p className="text-[12px] font-semibold text-white/40">
                        Preço unitário
                      </p>
                      <p className="mt-1 text-[14px] font-black tabular-nums text-white sm:text-[15px]">
                        {formatBRL(principalUnitPriceCents)}
                      </p>
                      <p className="mt-1 text-[12px] font-semibold tabular-nums text-white/80 line-through">
                        {geralDiscountPct > 0 ? formatBRL(prices.general) : ""}
                      </p>
                      <p className="text-[12px] font-bold text-primary">
                        {geralDiscountPct}% OFF
                      </p>
                      <p className="mt-1 text-[9px] leading-tight text-white/40">
                        a partir de 2 tickets
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-white/6 bg-black/25 px-3.5 py-2.5 text-[12px] text-white/50 sm:px-4">
                      <span>
                    Desconto aplicado:{" "}
                    <span className="font-bold text-primary">
                      {geralDiscountPct}%
                    </span>{" "}
                    OFF
                      </span>
                  <span className="inline-flex items-center gap-1 text-right font-medium">
                    Escolha a quantidade
                    <ChevronRight className="size-3.5 text-white/80" strokeWidth={2.4} />
                      </span>
                    </div>
              </div>

              {/* Card Bolão do Dia */}
              <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#121212] shadow-[0_8px_26px_rgba(0,0,0,0.35)]">
                <div className="grid grid-cols-[74px_minmax(0,1fr)] items-center gap-3 p-3 sm:grid-cols-[86px_minmax(0,1fr)] sm:p-3.5">
                  <div className="flex flex-col items-center justify-center">
                    <img
                      src={ticketBlue.src}
                      alt=""
                      className="h-[72px] w-[52px] shrink-0 object-contain drop-shadow-[0_8px_24px_rgba(59,130,246,0.35)] sm:h-[86px] sm:w-[62px]"
                    />
                    <span className="mt-1 text-[8px] font-black uppercase leading-tight tracking-wide text-primary">
                      Bolão do dia
                    </span>
                  </div>

                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
                    <div className="min-w-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="whitespace-nowrap text-[14px] font-black uppercase leading-tight text-white sm:text-[15px]">
                            Bolão do Dia
                          </h3>
                          <span className="w-fit shrink-0 rounded-md bg-primary/20 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-primary sm:text-[8px]">
                            Exclusivo
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] font-medium leading-snug text-white/80 sm:text-[11px]">
                          Acesso exclusivo ao bolão do dia
                        </p>
                      </div>

                    <div className="mt-3 flex w-fit items-center gap-1 rounded-[10px] border border-white/10 bg-[#0f0f0f] p-1">
                      <button
                        type="button"
                        aria-label="Diminuir Bolão do Dia"
                        disabled={dailyQty <= 0}
                        onClick={() => {
                          setError(null);
                          setCouponHint(null);
                          setDailyQty((q) => Math.max(0, q - 1));
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/20 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                      >
                        <span className="text-[18px] font-black leading-none">-</span>
                      </button>
                      <span className="w-8 text-center text-[18px] font-black tabular-nums text-white sm:text-[20px]">
                        {dailyQty}
                      </span>
                      <button
                        type="button"
                        aria-label="Aumentar Bolão do Dia"
                        disabled={dailyQty >= MAX_QTY}
                        onClick={() => {
                          setError(null);
                          setCouponHint(null);
                          setDailyQty((q) => Math.min(MAX_QTY, q + 1));
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/30 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                      >
                        <span className="text-[18px] font-black leading-none">+</span>
                      </button>
                    </div>
                  </div>

                    <div className="self-center text-right">
                      <p className="text-[12px] font-semibold text-white/40">
                        Preço unitário
                      </p>
                      <p className="mt-1 text-[14px] font-black tabular-nums text-white sm:text-[15px]">
                        {formatBRL(dailyUnitPriceCents)}
                      </p>
                      <p className="mt-1 text-[12px] font-semibold tabular-nums text-white/80 line-through">
                        {diarioDiscountPct > 0 ? formatBRL(prices.daily) : ""}
                      </p>
                      <p className="text-[12px] font-bold text-primary">
                        {diarioDiscountPct}% OFF
                      </p>
                      <p className="mt-1 text-[9px] leading-tight text-white/40">
                        a partir de 2 tickets
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-white/6 bg-black/25 px-3.5 py-2.5 text-[12px] text-white/50 sm:px-4">
                      <span>
                    Desconto aplicado:{" "}
                    <span className="font-bold text-primary">
                      {diarioDiscountPct}%
                    </span>{" "}
                    OFF
                      </span>
                  <span className="inline-flex items-center gap-1 text-right font-medium">
                    Escolha a quantidade
                    <ChevronRight className="size-3.5 text-white/80" strokeWidth={2.4} />
                      </span>
                    </div>
              </div>
                </>
              )}

              {extraBoloes.length > 0 && (
                <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#121212] shadow-[0_8px_26px_rgba(0,0,0,0.35)]">
                  <div className="min-w-0 overflow-x-auto border-b border-white/6 px-3 pb-2.5 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-3.5 sm:pb-3 sm:pt-3.5 [&::-webkit-scrollbar]:hidden">
                    <h3 className="inline-block w-max max-w-none whitespace-nowrap text-[14px] font-black uppercase leading-none tracking-[-0.03em] text-white min-[380px]:text-[15px] sm:text-[15px]">
                      {extraTicketHeadline}
                    </h3>
                  </div>
                  <div className="grid grid-cols-[74px_minmax(0,1fr)] items-start gap-3 p-3 sm:grid-cols-[86px_minmax(0,1fr)] sm:p-3.5">
                    <div className="flex flex-col items-center justify-center pt-0.5">
                      <img
                        src={extraCardIconSrc}
                        alt=""
                        className={
                          extraCardUsesCopaBrasilIcon
                            ? "h-[68px] w-[68px] shrink-0 rounded-[12px] object-contain sm:h-[78px] sm:w-[78px]"
                            : "h-[72px] w-[52px] shrink-0 object-contain sm:h-[86px] sm:w-[62px]"
                        }
                      />
                    </div>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
                      <div className="min-w-0">
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-[12px] font-medium leading-snug text-white/80 sm:text-[11px]">
                            Cota extra na rodada atual do campeonato.
                          </p>
                          {extraNamesUnique.length > 1 && (
                            <p className="text-[10px] font-medium leading-snug text-white/50">
                              Inclui: {extraNamesUnique.join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="mt-3 flex w-fit items-center gap-1 rounded-[10px] border border-white/10 bg-[#0f0f0f] p-1">
                          <button
                            type="button"
                            aria-label={`Diminuir ${extraTicketHeadline}`}
                            disabled={extraQuantity <= 0}
                            onClick={() => {
                              setError(null);
                              setCouponHint(null);
                              setExtraQuantity((q) => Math.max(0, q - 1));
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/20 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                          >
                            <span className="text-[18px] font-black leading-none">-</span>
                          </button>
                          <span className="w-8 text-center text-[18px] font-black tabular-nums text-white sm:text-[20px]">
                            {extraQuantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Aumentar ${extraTicketHeadline}`}
                            disabled={extraQuantity >= MAX_QTY}
                            onClick={() => {
                              setError(null);
                              setCouponHint(null);
                              setExtraQuantity((q) => Math.min(MAX_QTY, q + 1));
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/30 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                          >
                            <span className="text-[18px] font-black leading-none">+</span>
                          </button>
                        </div>
                      </div>
                      <div className="self-center text-right">
                        <p className="text-[12px] font-semibold text-white/40">Preço unitário</p>
                        <p className="mt-1 text-[14px] font-black tabular-nums text-white sm:text-[15px]">
                          {formatBRL(extraUnitPriceCents)}
                        </p>
                        <p className="mt-1 text-[12px] font-semibold tabular-nums text-white/80 line-through">
                          {extraDiscountPct > 0 ? formatBRL(prices.extra) : ""}
                        </p>
                        <p className="text-[12px] font-bold text-primary">{extraDiscountPct}% OFF</p>
                        <p className="mt-1 text-[9px] leading-tight text-white/40">
                          a partir de 2 tickets
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-white/6 bg-black/25 px-3.5 py-2.5 text-[12px] text-white/50 sm:px-4">
                    <span>
                      Desconto aplicado: <span className="font-bold text-primary">{extraDiscountPct}%</span> OFF
                    </span>
                    <span className="inline-flex items-center gap-1 text-right font-medium">
                      Escolha a quantidade
                      <ChevronRight className="size-3.5 text-white/80" strokeWidth={2.4} />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Resumo da compra ─────────────────────────────── */}
            <div className="rounded-[16px] border border-white/8 bg-[#171717] p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-black/40">
                    <ShoppingCart
                      className="size-[18px] text-primary"
                      strokeWidth={2.2}
                    />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-black tracking-tight text-white">
                      Resumo da compra
                    </h3>
                    <p className="text-[11px] font-medium text-white/40">
                      Revise antes de gerar o PIX
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCouponOpen((o) => !o);
                    setCouponHint(null);
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 text-left text-[11px] font-bold leading-snug text-primary hover:underline sm:text-[12px]"
                >
                  <Ticket className="size-3.5 shrink-0" strokeWidth={2.2} />
                  Possui cupom? Clique para inserir
                </button>
              </div>

              {couponOpen && (
                <div className="mb-4 flex flex-col gap-2 rounded-[12px] border border-white/10 bg-[#121212] p-3">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Código do cupom"
                    className="h-10 w-full rounded-[9px] border border-white/10 bg-black/60 px-3 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const t = couponCode.trim();
                      if (!t) {
                        setCouponHint("Digite um código.");
                        return;
                      }
                      setCouponHint(
                        "Cupons em breve — fique de olho nas promoções.",
                      );
                      setCouponCode("");
                    }}
                    className="h-9 rounded-[9px] bg-white/10 text-[12px] font-bold text-white transition-colors hover:bg-white/15"
                  >
                    Aplicar
                  </button>
                  {couponHint && (
                    <p className="text-[11px] font-medium text-primary/90">
                      {couponHint}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2.5 border-b border-white/10 pb-3">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-semibold text-white/70">
                    Bolão Geral · {principalQty}{" "}
                    {principalQty === 1 ? "ticket" : "tickets"}
                  </span>
                  <span className="shrink-0 font-black tabular-nums text-white">
                    {formatBRL(principalLineCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-semibold text-white/70">
                    Bolão do Dia · {dailyQty}{" "}
                    {dailyQty === 1 ? "ticket" : "tickets"}
                  </span>
                  <span className="shrink-0 font-black tabular-nums text-white">
                    {formatBRL(diarioLineCents)}
                  </span>
                </div>
                {extraQuantity > 0 && (
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-semibold text-white/70">
                      {extraResumoShortLabel} · {extraQuantity}{" "}
                      {extraQuantity === 1 ? "ticket" : "tickets"}
                    </span>
                    <span className="shrink-0 font-black tabular-nums text-white">
                      {formatBRL(extraLineCents)}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[13px] font-black uppercase tracking-wide text-white/50">
                  Total
                </span>
                <span className="text-[18px] font-black tabular-nums text-primary">
                  {formatBRL(totalCents)}
                </span>
                </div>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={goGenerate}
                className="mt-4 flex h-[56px] w-full items-center justify-center gap-3 rounded-[14px] bg-primary px-5 text-[13px] font-black uppercase tracking-[0.04em] text-[#0E141B] shadow-[0_4px_32px_rgba(177,235,11,0.55)] transition-[transform,filter] hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 sm:text-[14px]"
              >
                <Wallet className="size-5 shrink-0" strokeWidth={2.2} />
                <span>Finalizar compra · {formatBRL(totalCents)}</span>
                <ArrowRight className="size-5 shrink-0" strokeWidth={2.8} />
                </button>
            </div>

            {/* ── Confiança ───────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-[12px] border border-white/8 bg-[#171717] px-2 py-3 text-center sm:px-3">
                <Shield
                  className="mx-auto size-5 text-primary"
                  strokeWidth={2}
                />
                <p className="mt-2 text-[12px] font-black uppercase tracking-wide text-white">
                  100% Seguro
                </p>
                <p className="mt-1 text-[9px] leading-snug text-white/40">
                  Seus dados protegidos com criptografia.
                </p>
              </div>
              <div className="rounded-[12px] border border-white/8 bg-[#171717] px-2 py-3 text-center sm:px-3">
                <Zap className="mx-auto size-5 text-primary" strokeWidth={2} />
                <p className="mt-2 text-[12px] font-black uppercase tracking-wide text-white">
                  Instantâneo
                </p>
                <p className="mt-1 text-[9px] leading-snug text-white/40">
                  Acesso liberado na hora.
                </p>
              </div>
              <div className="rounded-[12px] border border-white/8 bg-[#171717] px-2 py-3 text-center sm:px-3">
                <Check
                  className="mx-auto size-5 text-primary"
                  strokeWidth={2.5}
                />
                <p className="mt-2 text-[12px] font-black uppercase tracking-wide text-white">
                  Sem taxas
                </p>
                <p className="mt-1 text-[9px] leading-snug text-white/40">
                  Você paga apenas pelo ticket.
                </p>
              </div>
            </div>

            {/* ── Botão depositar ──────────────────────────────── */}

                {error && (
              <p className="text-center text-[12px] font-semibold text-red-300">
                    {error}
                  </p>
                )}
            <p className="flex items-center justify-center gap-2 text-center text-[11px] font-medium text-white/25">
              <Lock className="size-3 shrink-0" strokeWidth={2} />
              Transação protegida por criptografia SSL 256-bit
            </p>
              </div>
            </div>
      ) : (
        <div className="min-h-screen w-full bg-black">
          {step === "generating" && <TicketPixGeneratingPanel />}
          {step === "pix" && pixPayload && (
            <TicketPixGeneratedScreen
              pixPayload={pixPayload}
              secondsLeft={secondsLeft}
              pixExpired={pixExpired}
              pixProgressPct={pixProgressPct}
              onCopy={copyPix}
              onBack={goBackFromPix}
              onVerifyPaid={() => void handleVerifyPaidClick()}
              checkingManually={checkingManually}
              confirmedPaid={confirmedPaid}
              error={error}
              principalQty={principalQty}
              dailyQty={dailyQty}
              extraPixLines={extraPixLines}
              prices={prices}
              principalUnitPriceCents={principalUnitPriceCents}
              dailyUnitPriceCents={dailyUnitPriceCents}
              totalCents={totalCents}
            />
          )}
        </div>
      )}
    </>
  );
}
