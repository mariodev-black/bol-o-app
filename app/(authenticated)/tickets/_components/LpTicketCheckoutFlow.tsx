"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import bannerCheckoutLp from "@/app/assets/banner-chekout-v2.png";
import { AppScreenLoading } from "@/app/shared/AppScreenLoading";
import {
  TicketPixGeneratedScreen,
  type TicketPixExtraLine,
} from "./pix/TicketPixGeneratedScreen";
import { TicketPixGeneratingPanel } from "./pix/TicketPixGeneratingPanel";
import {
  PIX_CHECKOUT_TOTAL_SEC,
  PIX_CHECKOUT_WINDOW_MS,
} from "./pix/ticket-pix-ui-constants";
import { appendTicketsFromPurchase } from "../lib/ownedTicketsStorage";
import {
  isBrasileiraoExtraChampionship,
  isPremierLeagueExtraChampionship,
  resolveExtraBolaoDisplayName,
} from "@/lib/boloes-extra-competition-branding";
import { applyTicketShopExtraCatalogItem } from "@/lib/ticket-shop-extra-display";

const DEFAULT_PRINCIPAL_CENTS = 3990;
const DEFAULT_EXTRA_CENTS = 1000;
const LP_ADDON_CENTS = 2400;

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function isPaidStatus(s: string): boolean {
  const v = (s || "").toLowerCase().trim();
  return v === "paid" || v === "approved" || v === "completed" || v === "confirmed";
}

function formatBRLNoSymbol(cents: number) {
  return formatBRL(cents).replace(/^R\$\s*/i, "").trim();
}

function lpBundleTotalCents(generalCents: number, quantity: number): number {
  if (quantity <= 0) return 0;
  // LP: 1 ticket no valor cheio; os demais entram com “preço de extra” fixo.
  return Math.round(generalCents + (quantity - 1) * LP_ADDON_CENTS);
}

type ExtraBolaoOption = {
  championshipId: number;
  unitCents: number;
  displayName?: string;
  roundNumber?: number;
  roundLabel?: string;
};

type FlowStep = "shop" | "generating" | "pix";

type DepositTransaction = {
  id: string;
  status: string;
  pixQrcode: string | null;
  providerTransactionId: string | null;
};

type TransactionUpdatePayload = {
  status?: string;
  pixQrcode?: string | null;
  providerTransactionId?: string | null;
};

const LP_QTY_OPTIONS = [1, 2, 3, 5] as const;

export function LpTicketCheckoutFlow() {
  const router = useRouter();
  const [step, setStep] = useState<FlowStep>("shop");
  const [selectedQty, setSelectedQty] = useState<(typeof LP_QTY_OPTIONS)[number]>(2);

  const [prices, setPrices] = useState({
    general: DEFAULT_PRINCIPAL_CENTS,
    extra: DEFAULT_EXTRA_CENTS,
  });
  const [extraBoloes, setExtraBoloes] = useState<ExtraBolaoOption[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);

  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState("");
  const [pixDeadline, setPixDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [checkingManually, setCheckingManually] = useState(false);
  const [confirmedPaid, setConfirmedPaid] = useState(false);

  const paidHandledRef = useRef(false);
  const purchasePrincipalRef = useRef(0);
  const purchaseExtraRef = useRef<Record<number, number>>({});

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
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/deposits/transactions", {
          credentials: "include",
        });
        const d = (await r.json()) as {
          prices?: { general: number; extra?: number };
          extraBoloes?: Array<{
            championshipId: number;
            unitCents: number;
            displayName?: string;
            roundNumber?: number;
            roundLabel?: string;
          }>;
        };
        if (cancelled) return;
        if (r.ok && d.prices?.general) {
          setPrices({
            general: d.prices.general,
            extra: d.prices.extra ?? DEFAULT_EXTRA_CENTS,
          });
        }
        if (r.ok && Array.isArray(d.extraBoloes) && d.extraBoloes.length > 0) {
          setExtraBoloes(
            d.extraBoloes.map((row) => applyTicketShopExtraCatalogItem(row)),
          );
        }
      } catch {
        // fallback nos valores default locais
      } finally {
        if (!cancelled) setCatalogReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedExtrasForQty = useMemo(() => {
    const extrasToInclude = Math.max(0, selectedQty - 1);
    if (extrasToInclude <= 0) return [];
    if (extraBoloes.length <= 0) return [];

    const brasileirao = extraBoloes.filter((b) =>
      isBrasileiraoExtraChampionship(b.championshipId, b.displayName),
    );
    const premier = extraBoloes.filter((b) =>
      isPremierLeagueExtraChampionship(b.championshipId, b.displayName),
    );
    const rest = extraBoloes.filter(
      (b) =>
        !isBrasileiraoExtraChampionship(b.championshipId, b.displayName) &&
        !isPremierLeagueExtraChampionship(b.championshipId, b.displayName),
    );

    const picked = [...brasileirao, ...premier, ...rest].slice(0, extrasToInclude);
    // evita duplicar o mesmo campeonato, caso o catálogo venha repetido
    const seen = new Set<number>();
    return picked.filter((b) => {
      if (seen.has(b.championshipId)) return false;
      seen.add(b.championshipId);
      return true;
    });
  }, [selectedQty, extraBoloes]);

  const extrasSumCents = useMemo(
    () => selectedExtrasForQty.reduce((sum, b) => sum + b.unitCents, 0),
    [selectedExtrasForQty],
  );

  const bundleTotalCents = useMemo(
    () => lpBundleTotalCents(prices.general, selectedQty),
    [prices.general, selectedQty],
  );

  const principalLineCents = Math.max(0, bundleTotalCents - extrasSumCents);
  const totalCents = bundleTotalCents;
  const principalUnitPriceCents =
    selectedQty > 0 ? Math.round(principalLineCents / selectedQty) : prices.general;
  const secondsLeft =
    step === "pix" && pixDeadline != null
      ? Math.max(0, Math.ceil((pixDeadline - now) / 1000))
      : 0;
  const pixExpired = step === "pix" && pixDeadline != null && secondsLeft === 0;
  const pixProgressPct =
    step === "pix" && pixDeadline != null
      ? Math.min(100, Math.max(0, (secondsLeft / PIX_CHECKOUT_TOTAL_SEC) * 100))
      : 0;

  const lpGeneralQty = selectedExtrasForQty.length > 0 ? 1 : selectedQty;
  const lpExtraByChampionship = useMemo(
    () =>
      Object.fromEntries(
        selectedExtrasForQty.map((b) => [String(b.championshipId), 1] as const),
      ),
    [selectedExtrasForQty],
  );

  const goGenerate = useCallback(() => {
    setError(null);
    setStep("generating");
    void (async () => {
      try {
        const r = await fetch("/api/deposits/transactions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Pacote LP: N tickets = 1 geral + (N-1) extras (não N gerais + extras).
            generalQuantity: lpGeneralQty,
            dailyQuantity: 0,
            extraByChampionship: lpExtraByChampionship,
          }),
        });
        const d = (await r.json()) as {
          error?: string;
          transaction?: DepositTransaction;
        };
        if (!r.ok || !d.transaction?.pixQrcode) {
          setError(d.error ?? "Nao foi possivel gerar o PIX.");
          setStep("shop");
          return;
        }
        purchasePrincipalRef.current = lpGeneralQty;
        purchaseExtraRef.current = Object.fromEntries(
          selectedExtrasForQty.map((b) => [b.championshipId, 1] as const),
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
  }, [lpGeneralQty, lpExtraByChampionship, selectedExtrasForQty]);

  const goBackFromPix = useCallback(() => {
    setStep("shop");
    setPixPayload("");
    setTransactionId(null);
    setPixDeadline(null);
    setConfirmedPaid(false);
    paidHandledRef.current = false;
    setError(null);
  }, []);

  const handleTransactionUpdate = useCallback(
    (payload: TransactionUpdatePayload, source: "sse" | "poll" | "manual") => {
      if (payload.pixQrcode) setPixPayload(payload.pixQrcode);

      if (
        transactionId &&
        payload.status &&
        isPaidStatus(payload.status) &&
        !paidHandledRef.current
      ) {
        paidHandledRef.current = true;
        setConfirmedPaid(true);
        const extraTotal = Object.values(purchaseExtraRef.current).reduce((s, n) => s + n, 0);
        appendTicketsFromPurchase(
          purchasePrincipalRef.current,
          0,
          purchaseExtraRef.current,
        );
        const q = new URLSearchParams({
          tx: transactionId,
          principal: String(purchasePrincipalRef.current),
          diario: "0",
        });
        if (extraTotal > 0) q.set("extra", String(extraTotal));
        window.setTimeout(() => {
          router.replace(`/tickets/obrigado?${q.toString()}`);
        }, 1500);
      }
    },
    [router, transactionId],
  );

  // SSE
  useEffect(() => {
    if (step !== "pix" || !transactionId) return;
    const es = new EventSource(`/api/deposits/transactions/${transactionId}/events`);
    es.addEventListener("transaction", (evt) => {
      try {
        const payload = JSON.parse((evt as MessageEvent).data) as TransactionUpdatePayload;
        handleTransactionUpdate(payload, "sse");
      } catch {
        // ignore
      }
    });
    return () => es.close();
  }, [step, transactionId, handleTransactionUpdate]);

  // Polling fallback
  useEffect(() => {
    if (step !== "pix" || !transactionId) return;
    let cancelled = false;

    async function pollTransaction() {
      if (paidHandledRef.current) return;
      try {
        const r = await fetch(`/api/deposits/transactions/${transactionId}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await r.json()) as { transaction?: DepositTransaction };
        if (cancelled || !r.ok || !data.transaction) return;
        handleTransactionUpdate(
          {
            status: data.transaction.status,
            pixQrcode: data.transaction.pixQrcode,
            providerTransactionId: data.transaction.providerTransactionId,
          },
          "poll",
        );
      } catch {
        // ignore
      }
    }

    void pollTransaction();
    const id = window.setInterval(() => void pollTransaction(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, transactionId, handleTransactionUpdate]);

  const handleVerifyPaidClick = useCallback(async () => {
    if (!transactionId || checkingManually) return;
    setCheckingManually(true);
    try {
      const r = await fetch(`/api/deposits/transactions/${transactionId}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await r.json()) as { transaction?: DepositTransaction };
      if (r.ok && data.transaction) {
        handleTransactionUpdate(
          {
            status: data.transaction.status,
            pixQrcode: data.transaction.pixQrcode,
            providerTransactionId: data.transaction.providerTransactionId,
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

  const optionCards = useMemo(() => {
    return LP_QTY_OPTIONS.map((qty) => {
      const originalCents = prices.general * qty;
      const bundleTotal = lpBundleTotalCents(prices.general, qty);
      const savingsCents = Math.max(0, originalCents - bundleTotal);
      return { qty, bundleTotal, originalCents, savingsCents };
    });
  }, [prices.general]);

  if (step !== "shop") {
    return (
      <div className="min-h-screen w-full bg-black">
        {step === "generating" && <TicketPixGeneratingPanel />}
        {step === "pix" && pixPayload && (
          <TicketPixGeneratedScreen
            pixPayload={pixPayload}
            secondsLeft={secondsLeft}
            pixExpired={pixExpired}
            pixProgressPct={pixProgressPct}
            onCopy={() => void navigator.clipboard.writeText(pixPayload)}
            onBack={goBackFromPix}
            onVerifyPaid={() => void handleVerifyPaidClick()}
            checkingManually={checkingManually}
            confirmedPaid={confirmedPaid}
            error={error}
            principalQty={lpGeneralQty}
            dailyQty={0}
            extraPixLines={selectedExtrasForQty.map((b) => ({
              championshipId: b.championshipId,
              qty: 1,
              lineCents: b.unitCents,
              displayLabel: (() => {
                const base = resolveExtraBolaoDisplayName(b.championshipId, b.displayName);
                return b.roundLabel ? `${base} ${b.roundLabel}` : base;
              })(),
            }))}
            prices={{ general: prices.general, daily: 0 }}
            principalUnitPriceCents={principalUnitPriceCents}
            dailyUnitPriceCents={0}
            totalCents={totalCents}
          />
        )}
      </div>
    );
  }

  return !catalogReady ? (
    <AppScreenLoading
      variant="app-shell"
      message="Carregando valores..."
      className="w-full flex-1"
    />
  ) : (
    <div className="min-h-screen w-full bg-black pb-10">
      <div className="relative w-full overflow-hidden rounded-b-[22px]">
        <Image
          src={bannerCheckoutLp}
          alt="Checkout — Bolão do Milhão"
          className="h-auto w-full object-cover object-center"
          priority
          sizes="100vw"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black to-transparent"
          aria-hidden
        />
      </div>

      <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 pt-5 pb-10">
        <p className="text-[14px] font-black uppercase tracking-wide text-white/90">
          ESCOLHA QUANTOS TICKETS DESEJA:
        </p>

        <div className="space-y-3">
          {optionCards.map((o) => {
            const active = o.qty === selectedQty;

            const contentByQty: Record<
              number,
              {
                title: string;
                subtitle: ReactNode;
                badge?: string;
              }
            > = {
              1: {
                title: "1 TICKET",
                subtitle: (
                  <span className="text-primary">Sua chance de ganhar!</span>
                ),
              },
              2: {
                title: "2 TICKETS",
                badge: "MAIS ESCOLHIDO",
                subtitle: (
                  <>
                    O 2º ticket sai com{" "}
                    <span className="text-primary">50% de desconto!</span>
                  </>
                ),
              },
              3: {
                title: "3 TICKETS",
                subtitle: "Mais chances, mais possibilidades!",
              },
              5: {
                title: "5 TICKETS",
                badge: "MELHOR CUSTO BENEFÍCIO",
                subtitle: "O pacote com melhor custo benefício",
              },
            };

            const cfg = contentByQty[o.qty];
            const savingsText = o.savingsCents > 0 ? formatBRLNoSymbol(o.savingsCents) : null;
            const hasDiscount = o.qty > 1 && o.savingsCents > 0;

            return (
              <button
                key={o.qty}
                type="button"
                onClick={() => setSelectedQty(o.qty)}
                className={[
                  "w-full rounded-[16px] bg-[#121212] p-4 text-left shadow-[0_8px_26px_rgba(0,0,0,0.35)] transition-[transform,filter] hover:brightness-105 active:scale-[0.99]",
                  "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={[
                        "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full",
                        active
                          ? "bg-primary shadow-[0_0_18px_rgba(177,235,11,0.35)]"
                          : "border border-primary/40 bg-black",
                      ].join(" ")}
                      aria-hidden
                    />

                    <div className="min-w-0">
                      {cfg.badge && (
                        <div className="mb-2">
                          <span className="inline-flex rounded-md bg-primary px-2 py-1 text-[8px] font-black uppercase tracking-wide text-[#0E141B]">
                            {cfg.badge}
                          </span>
                        </div>
                      )}

                      <p className="text-[14px] font-black uppercase leading-tight text-white">
                        {cfg.title}
                      </p>
                      <p className="mt-1 text-[11px] font-medium leading-snug text-white/60">
                        {cfg.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {hasDiscount && (
                      <p className="text-[11px] font-semibold tabular-nums text-white/40 line-through">
                        {formatBRL(o.originalCents)}
                      </p>
                    )}
                    <p className="mt-0.5 text-[20px] font-black tabular-nums text-primary leading-none">
                      {formatBRL(o.bundleTotal)}
                    </p>
                    {hasDiscount && savingsText && (
                      <div className="mt-1 inline-flex rounded-md bg-primary px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#0E141B]">
                        ECONOMIZE R$ {savingsText}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-[18px] bg-[#171717] p-4">
          <div className="mb-3">
            <h3 className="text-[14px] font-black uppercase tracking-wide text-white">
              Resumo do pedido
            </h3>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="font-semibold text-white/70">
                {selectedQty} {selectedQty === 1 ? "Cota" : "Cotas"} - Bolão do Milhão
              </span>
              <span className="shrink-0 font-black tabular-nums text-primary">
                {formatBRL(principalLineCents)}
              </span>
            </div>

            {selectedExtrasForQty.map((b) => {
              const base = resolveExtraBolaoDisplayName(b.championshipId, b.displayName);
              const label = b.roundLabel ? `${base} ${b.roundLabel}` : base;
              return (
                <div
                  key={b.championshipId}
                  className="flex items-center justify-between gap-2 text-[13px]"
                >
                  <span className="font-semibold text-white/70">
                    1 Cota - {label}
                  </span>
                  <span className="shrink-0 font-black tabular-nums text-primary">
                    {formatBRL(b.unitCents)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-[16px] font-black uppercase tracking-wide text-white/50">
              TOTAL
            </span>
            <span className="text-[20px] font-black tabular-nums text-primary">
              {formatBRL(totalCents)}
            </span>
          </div>

          <button
            type="button"
            onClick={goGenerate}
            className="mt-4 flex h-[56px] w-full items-center justify-center rounded-[14px] bg-primary px-5 text-[16px] font-black uppercase tracking-[0.04em] text-[#0E141B] shadow-[0_4px_32px_rgba(177,235,11,0.55)] transition-[transform,filter] hover:brightness-105 active:scale-[0.98]"
          >
            FINALIZAR COMPRA
          </button>

          {error && (
            <p className="mt-3 text-center text-[12px] font-semibold text-red-300">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

