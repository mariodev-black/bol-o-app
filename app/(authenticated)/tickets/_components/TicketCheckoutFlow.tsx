"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "react-qr-code";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Lock,
  Percent,
  Shield,
  ShoppingCart,
  Tag,
  Ticket,
  Trophy,
  Wallet,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import bannerCheckout from "@/app/assets/banner-chekout.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import ticketGold from "@/app/assets/ticket-gold.png";
import { appendTicketsFromPurchase } from "../lib/ownedTicketsStorage";

const GOLD = "#B1EB0B";
const GOLD_LIGHT = "#E8FF8A";
const CARD = "#101010";
const DEFAULT_PRINCIPAL_CENTS = 3990;
const DEFAULT_DIARIO_CENTS = 2000;
const DEFAULT_EXTRA_CENTS = 3990;
const PIX_WINDOW_MS = 5 * 60 * 1000;
const PIX_TOTAL_SEC = 5 * 60;
const montserrat = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function isPaidStatus(s: string): boolean {
  const v = (s || "").toLowerCase().trim();
  return v === "paid" || v === "approved" || v === "success" || v === "completed" || v === "confirmed";
}

function statusLabelPt(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "waiting_payment" || s === "pending_payment" || s === "creating") return "Aguardando pagamento";
  if (s === "paid" || s === "approved") return "Pago";
  if (s === "failed") return "Falhou";
  if (s === "expired") return "Expirado";
  if (s === "cancelled" || s === "canceled") return "Cancelado";
  return "Em processamento";
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
  initialTicketKind?: "general" | "daily";
};

const MAX_QTY = 20;

export function TicketCheckoutFlow({ initialTicketKind = "general" }: TicketCheckoutFlowProps) {
  const router = useRouter();
  const [principalQty, setPrincipalQty] = useState(() =>
    initialTicketKind === "daily" ? 0 : 1
  );
  const [dailyQty, setDailyQty] = useState(() => (initialTicketKind === "daily" ? 1 : 0));
  const [prices, setPrices] = useState({
    general: DEFAULT_PRINCIPAL_CENTS,
    daily: DEFAULT_DIARIO_CENTS,
    extra: DEFAULT_EXTRA_CENTS,
  });
  const [step, setStep] = useState<FlowStep>("shop");
  const [orderRef, setOrderRef] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>("");
  const [pixPayload, setPixPayload] = useState("");
  const [copied, setCopied] = useState(false);
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

  const handleTransactionUpdate = useCallback(
    (payload: TransactionUpdatePayload, source?: string) => {
      if (payload.status) {
        console.log("[PIX] status update", { source, status: payload.status, transactionId });
        setTxStatus(payload.status);
      }
      if (payload.pixQrcode) setPixPayload(payload.pixQrcode);
      if (payload.providerTransactionId) setOrderRef(payload.providerTransactionId);

      if (transactionId && payload.status && isPaidStatus(payload.status) && !paidHandledRef.current) {
        console.log("[PIX] PAGAMENTO CONFIRMADO — redirecionando", { source, status: payload.status });
        paidHandledRef.current = true;
        setConfirmedPaid(true);
        appendTicketsFromPurchase(purchasePrincipalRef.current, purchaseDiarioRef.current);
        const q = new URLSearchParams({
          tx: transactionId,
          principal: String(purchasePrincipalRef.current),
          diario: String(purchaseDiarioRef.current),
        });
        // Pequeno delay para o usuário ver o feedback "Pagamento confirmado!"
        window.setTimeout(() => {
          router.replace(`/tickets/obrigado?${q.toString()}`);
        }, 1500);
      }
    },
    [router, transactionId]
  );

  useEffect(() => {
    if (step === "generating" || step === "pix") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [step]);

  useEffect(() => {
    if (step !== "shop" && step !== "pix") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [step]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/deposits/transactions", { credentials: "include" });
        const d = (await r.json()) as { prices?: { general: number; daily: number; extra?: number } };
        if (r.ok && d.prices) {
          setPrices({
            general: d.prices.general,
            daily: d.prices.daily,
            extra: d.prices.extra ?? DEFAULT_EXTRA_CENTS,
          });
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
    const es = new EventSource(`/api/deposits/transactions/${transactionId}/events`);
    es.onopen = () => console.log("[PIX] SSE conectado");
    es.onerror = (e) => console.warn("[PIX] SSE erro", e);
    es.addEventListener("transaction", (evt) => {
      try {
        const payload = JSON.parse((evt as MessageEvent).data) as TransactionUpdatePayload;
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
          "poll"
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

  const principalLineCents =
    principalQty <= 0
      ? 0
      : principalQty === 1
        ? prices.general
        : principalQty === 2
          ? prices.general + prices.extra
          : principalQty * prices.general;
  const diarioLineCents = dailyQty * prices.daily;
  const totalCents = principalLineCents + diarioLineCents;
  const totalQty = principalQty + dailyQty;
  const hasSelection = totalCents > 0 && totalQty >= 1;
  const geralListCents = principalQty * prices.general;
  const geralDiscountPct =
    principalQty === 2 && geralListCents > principalLineCents
      ? Math.round(((geralListCents - principalLineCents) / geralListCents) * 100)
      : 0;
  const geralEffectiveEachCents =
    principalQty > 0 ? Math.round(principalLineCents / principalQty) : 0;
  const secondsLeft =
    step === "pix" && pixDeadline != null ? Math.max(0, Math.ceil((pixDeadline - now) / 1000)) : 0;
  const pixExpired = step === "pix" && pixDeadline != null && secondsLeft === 0;
  const pixProgressPct =
    step === "pix" && pixDeadline != null ? Math.min(100, Math.max(0, (secondsLeft / PIX_TOTAL_SEC) * 100)) : 0;

  const goGenerate = useCallback(() => {
    if (!hasSelection) return;
    if (principalQty + dailyQty <= 0) {
      setError("Selecione pelo menos um ticket.");
      return;
    }
    setError(null);
    setCouponHint(null);
    setCopied(false);
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
            amountCents: totalCents,
          }),
        });
        const d = (await r.json()) as { error?: string; transaction?: DepositTransaction };
        if (!r.ok || !d.transaction || !d.transaction.pixQrcode) {
          setError(d.error ?? "Nao foi possivel gerar o PIX.");
          setStep("shop");
          return;
        }
        purchasePrincipalRef.current = principalQty;
        purchaseDiarioRef.current = dailyQty;
        setTransactionId(d.transaction.id);
        setTxStatus(d.transaction.status);
        setPixPayload(d.transaction.pixQrcode);
        setOrderRef(d.transaction.providerTransactionId ?? d.transaction.id);
        setPixDeadline(Date.now() + PIX_WINDOW_MS);
        setStep("pix");
      } catch {
        setError("Erro de rede ao gerar o PIX.");
        setStep("shop");
      }
    })();
  }, [hasSelection, principalQty, dailyQty, totalCents]);

  const copyPix = useCallback(() => {
    if (!pixPayload || pixExpired) return;
    void navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }, [pixPayload, pixExpired]);

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
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-primary/35 bg-primary/10">
                  <Wallet className="size-[22px] text-primary" strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[18px] font-black leading-tight text-white">Comprar tickets</h2>
                  <p className="mt-1 text-[12px] font-medium leading-snug text-white/45">
                    Escolha seus tickets e aproveite os descontos!
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1">
                <Shield className="size-3.5 text-primary" strokeWidth={2.2} />
                <span className="text-[10px] font-black uppercase tracking-wide text-primary">Seguro</span>
              </div>
            </div>

            {/* Faixa promocional (não é o banner superior) */}
            <div className="flex items-center gap-3 rounded-[14px] border border-[#CA8A04]/50 bg-gradient-to-r from-[#1c1708]/95 to-black/90 px-3.5 py-3">
              <Tag className="size-8 shrink-0 text-[#FACC15]" strokeWidth={2.2} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase leading-tight tracking-wide text-[#FDE047] sm:text-[12px]">
                  Acima de 2 tickets gerais tem desconto no 2º!
                </p>
                <p className="mt-1 text-[10px] font-medium leading-snug text-white/55 sm:text-[11px]">
                  Quanto mais tickets, maior a chance de ganhar.
                </p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#FACC15]/40 bg-[#FACC15]/10">
                <Percent className="size-5 text-[#FDE047]" strokeWidth={2.2} />
              </div>
            </div>

            <div className="space-y-3">
              {/* Card Bolão Geral */}
              <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#121212]">
                <div className="flex gap-3 p-3.5 sm:p-4">
                  <img
                    src={ticketGold.src}
                    alt=""
                    className="h-[72px] w-[52px] shrink-0 self-center object-contain drop-shadow-[0_8px_24px_rgba(177,235,11,0.35)] sm:h-[88px] sm:w-[64px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-black leading-tight text-white">Bolão Geral</h3>
                      <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary">
                        Mais popular
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium leading-snug text-white/45">
                      Acesso a todas as rodadas da Copa do Milhão
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 px-3.5 py-3 sm:px-4">
                  <div className="flex shrink-0 items-center gap-1 rounded-[12px] border border-white/10 bg-[#0f0f0f] p-1.5">
                    <button
                      type="button"
                      aria-label="Diminuir Bolão Geral"
                      disabled={principalQty <= 0}
                      onClick={() => {
                        setError(null);
                        setCouponHint(null);
                        setPrincipalQty((q) => Math.max(0, q - 1));
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-white/6 text-white/60 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-30"
                    >
                      <ChevronDown className="size-[18px]" strokeWidth={2.5} />
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
                      className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-white/6 text-white/60 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-30"
                    >
                      <ChevronUp className="size-[18px]" strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-white/40">Preço unitário</p>
                    <p className="text-[13px] font-black tabular-nums text-white">{formatBRL(prices.general)}</p>
                    <p className="text-[10px] font-bold text-primary">
                      {geralDiscountPct > 0 ? `${geralDiscountPct}% de desconto` : "0% de desconto"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/6 bg-black/25 px-3.5 py-2.5 text-[10px] text-white/50 sm:px-4">
                  <span>
                    Desconto aplicado:{" "}
                    <span className="font-bold text-primary">{geralDiscountPct > 0 ? `${geralDiscountPct}%` : "0%"}</span>{" "}
                    OFF
                  </span>
                  <span className="text-right font-medium">
                    {principalQty > 0 ? (
                      <>
                        De {formatBRL(prices.general)} cada por{" "}
                        <span className="font-black text-white">{formatBRL(geralEffectiveEachCents)}</span> cada
                      </>
                    ) : (
                      <>Escolha a quantidade</>
                    )}
                  </span>
                </div>
              </div>

              {/* Card Bolão do Dia */}
              <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#121212]">
                <div className="flex gap-3 p-3.5 sm:p-4">
                  <img
                    src={ticketBlue.src}
                    alt=""
                    className="h-[72px] w-[52px] shrink-0 self-center object-contain drop-shadow-[0_8px_24px_rgba(59,130,246,0.35)] sm:h-[88px] sm:w-[64px]"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-black leading-tight text-white">Bolão do Dia</h3>
                    <p className="mt-1 text-[11px] font-medium leading-snug text-white/45">
                      Acesso exclusivo ao bolão do dia
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/6 px-3.5 py-3 sm:px-4">
                  <div className="flex shrink-0 items-center gap-1 rounded-[12px] border border-white/10 bg-[#0f0f0f] p-1.5">
                    <button
                      type="button"
                      aria-label="Diminuir Bolão do Dia"
                      disabled={dailyQty <= 0}
                      onClick={() => {
                        setError(null);
                        setCouponHint(null);
                        setDailyQty((q) => Math.max(0, q - 1));
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-white/6 text-white/60 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-30"
                    >
                      <ChevronDown className="size-[18px]" strokeWidth={2.5} />
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
                      className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-white/6 text-white/60 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-30"
                    >
                      <ChevronUp className="size-[18px]" strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-white/40">Preço unitário</p>
                    <p className="text-[13px] font-black tabular-nums text-white">{formatBRL(prices.daily)}</p>
                    <p className="text-[10px] font-bold text-primary">0% de desconto</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/6 bg-black/25 px-3.5 py-2.5 text-[10px] text-white/50 sm:px-4">
                  <span>
                    Desconto aplicado: <span className="font-bold text-primary">0%</span> OFF
                  </span>
                  <span className="text-right font-medium">
                    {dailyQty > 0 ? (
                      <>
                        De {formatBRL(prices.daily)} cada por{" "}
                        <span className="font-black text-white">{formatBRL(prices.daily)}</span> cada
                      </>
                    ) : (
                      <>Escolha a quantidade</>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Resumo da compra ─────────────────────────────── */}
            <div className="rounded-[16px] border border-white/8 bg-[#171717] p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-black/40">
                    <ShoppingCart className="size-[18px] text-primary" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-black tracking-tight text-white">Resumo da compra</h3>
                    <p className="text-[11px] font-medium text-white/40">Revise antes de gerar o PIX</p>
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
                      setCouponHint("Cupons em breve — fique de olho nas promoções.");
                      setCouponCode("");
                    }}
                    className="h-9 rounded-[9px] bg-white/10 text-[12px] font-bold text-white transition-colors hover:bg-white/15"
                  >
                    Aplicar
                  </button>
                  {couponHint && <p className="text-[11px] font-medium text-primary/90">{couponHint}</p>}
                </div>
              )}

              <div className="space-y-2.5 border-b border-white/10 pb-3">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-semibold text-white/70">
                    Bolão Geral · {principalQty} {principalQty === 1 ? "ticket" : "tickets"}
                  </span>
                  <span className="shrink-0 font-black tabular-nums text-white">{formatBRL(principalLineCents)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-semibold text-white/70">
                    Bolão do Dia · {dailyQty} {dailyQty === 1 ? "ticket" : "tickets"}
                  </span>
                  <span className="shrink-0 font-black tabular-nums text-white">{formatBRL(diarioLineCents)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[13px] font-black uppercase tracking-wide text-white/50">Total</span>
                <span className="text-[18px] font-black tabular-nums text-primary">{formatBRL(totalCents)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={!hasSelection}
              onClick={goGenerate}
              className="flex h-[62px] w-full items-center justify-center gap-3 rounded-[16px] bg-primary px-5 text-[15px] font-black uppercase tracking-[0.04em] text-[#0E141B] shadow-[0_4px_32px_rgba(177,235,11,0.55)] transition-[transform,filter] hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Wallet className="size-5 shrink-0" strokeWidth={2.2} />
              <span>Finalizar compra · {formatBRL(totalCents)}</span>
              <ArrowRight className="size-5 shrink-0" strokeWidth={2.8} />
            </button>

            {/* ── Confiança ───────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-[12px] border border-white/8 bg-[#171717] px-2 py-3 text-center sm:px-3">
                <Shield className="mx-auto size-5 text-primary" strokeWidth={2} />
                <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-white">100% Seguro</p>
                <p className="mt-1 text-[9px] leading-snug text-white/40">Seus dados protegidos com criptografia.</p>
              </div>
              <div className="rounded-[12px] border border-white/8 bg-[#171717] px-2 py-3 text-center sm:px-3">
                <Zap className="mx-auto size-5 text-primary" strokeWidth={2} />
                <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-white">Instantâneo</p>
                <p className="mt-1 text-[9px] leading-snug text-white/40">Acesso liberado na hora.</p>
              </div>
              <div className="rounded-[12px] border border-white/8 bg-[#171717] px-2 py-3 text-center sm:px-3">
                <Check className="mx-auto size-5 text-primary" strokeWidth={2.5} />
                <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-white">Sem taxas</p>
                <p className="mt-1 text-[9px] leading-snug text-white/40">Você paga apenas pelo ticket.</p>
              </div>
            </div>

            {/* ── Botão depositar ──────────────────────────────── */}
           
            {error && <p className="text-center text-[12px] font-semibold text-red-300">{error}</p>}
            <p className="flex items-center justify-center gap-2 text-center text-[11px] font-medium text-white/25">
              <Lock className="size-3 shrink-0" strokeWidth={2} />
              Transação protegida por criptografia SSL 256-bit
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-1 flex-col justify-start bg-black px-4 py-8 sm:px-6 sm:py-10">
          <section className="w-full">

          {step === "generating" && (
            <div
              className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl"
              style={{
                border: "1px solid rgba(177,235,11,0.18)",
                background: `linear-gradient(180deg, rgba(14,20,32,0.96) 0%, ${CARD} 100%)`,
              }}
            >
              <Loader2 className="w-12 h-12 animate-spin mb-5" style={{ color: GOLD_LIGHT }} strokeWidth={2} />
              <p className="text-lg font-semibold text-white text-center" style={{ fontFamily: montserrat }}>
                Emitindo cobrança PIX
              </p>
              <p className="text-[15px] text-center mt-2 max-w-sm leading-relaxed" style={{ color: "rgba(226,213,184,0.5)" }}>
                Registrando pedido no sistema Bolão do Milhão…
              </p>
            </div>
          )}

          {step === "pix" && pixPayload && (
            <div className="space-y-4">

              {/* overlay de confirmação */}
              {confirmedPaid && (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#0AC96B]/40 bg-[#0AC96B]/10 px-6 py-8 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-[#0AC96B]/20 border border-[#0AC96B]/40">
                    <Check className="size-7 text-[#0AC96B]" strokeWidth={2.5} />
                  </span>
                  <p className="text-[18px] font-black text-white">Pagamento confirmado!</p>
                  <p className="text-[13px] text-white/55">Redirecionando para seus tickets…</p>
                  <Loader2 className="size-5 animate-spin text-[#0AC96B]/70" />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/45">PIX</span>
                  <span className="text-[12px] font-mono text-white/55 truncate max-w-[55%]">{orderRef}</span>
                </div>
                <div className="flex items-center justify-between text-[13px] mb-1" style={{ color: "rgba(226,213,184,0.55)" }}>
                  <span>{pixExpired ? "Expirado" : "Válido 5 min"}</span>
                  <span className="font-mono tabular-nums text-white/65">{pixExpired ? "0:00" : formatCountdown(secondsLeft)}</span>
                </div>
                <p className="text-[12px] text-white/50 mt-0.5 mb-1">
                  Status:{" "}
                  <span
                    className={
                      isPaidStatus(txStatus || "")
                        ? "font-bold text-[#0AC96B]"
                        : "font-semibold text-white/80"
                    }
                  >
                    {statusLabelPt(txStatus || "waiting_payment")}
                  </span>
                </p>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: pixExpired ? "rgba(127,29,29,0.35)" : "rgba(255,255,255,0.08)" }}
                  role="progressbar"
                  aria-valuenow={pixExpired ? 0 : Math.round(pixProgressPct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                    style={{
                      width: `${pixProgressPct}%`,
                      background: pixExpired
                        ? "rgba(248,113,113,0.5)"
                        : secondsLeft <= 60
                          ? "linear-gradient(90deg, #FBBF24, #F59E0B)"
                          : `linear-gradient(90deg, ${GOLD_LIGHT}, ${GOLD})`,
                    }}
                  />
                </div>
              </div>

              <div
                className="rounded-xl p-3 sm:p-4 space-y-4"
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: `linear-gradient(180deg, rgba(16,22,36,0.95) 0%, ${CARD} 100%)`,
                }}
              >
                <div className="relative mx-auto w-fit">
                  <div
                    className={`p-3.5 rounded-2xl bg-white shadow-xl ${pixExpired ? "opacity-35 grayscale" : ""}`}
                    style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.45)" }}
                  >
                    <QRCode value={pixPayload} size={196} level="M" />
                  </div>
                  {pixExpired && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/55 px-4">
                      <p className="text-center text-[15px] font-semibold text-white leading-snug px-1">
                        QR expirado — gere outro para pagar
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1">Pedido</p>
                  <p className="text-[12px] mb-2 leading-snug" style={{ color: "rgba(226,213,184,0.45)" }}>
                    Geral {formatBRL(prices.general)} · Diário {formatBRL(prices.daily)} · {totalQty} ticket
                    {totalQty === 1 ? "" : "s"}
                  </p>
                  <div className="space-y-1.5 text-[14px]">
                    {principalQty > 0 && (
                      <div className="flex justify-between gap-2 text-white/65">
                        <span>
                          <span className="font-mono text-white">{principalQty}×</span> Geral
                          <span className="text-white/35 font-normal"> @ {formatBRL(prices.general)}</span>
                        </span>
                        <span className="tabular-nums font-medium" style={{ color: GOLD_LIGHT }}>
                          {formatBRL(principalLineCents)}
                        </span>
                      </div>
                    )}
                    {dailyQty > 0 && (
                      <div className="flex justify-between gap-2 text-white/65">
                        <span>
                          <span className="font-mono text-white">{dailyQty}×</span> Diário
                          <span className="text-white/35 font-normal"> @ {formatBRL(prices.daily)}</span>
                        </span>
                        <span className="tabular-nums font-medium" style={{ color: GOLD_LIGHT }}>
                          {formatBRL(diarioLineCents)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 pt-2 mt-1 border-t border-white/10 text-[15px] font-bold text-white">
                      <span>Total</span>
                      <span className="tabular-nums" style={{ color: GOLD_LIGHT }}>
                        {formatBRL(totalCents)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-white/45 mb-2">PIX copia e cola</label>
                  <div
                    className="rounded-xl p-3.5 max-h-[100px] overflow-y-auto"
                    style={{
                      background: "rgba(0,0,0,0.42)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <p className="text-[11px] sm:text-[12px] font-mono text-white/75 break-all leading-relaxed">{pixPayload}</p>
                  </div>
                  <button
                    type="button"
                    onClick={copyPix}
                    disabled={pixExpired}
                    className="mt-3 w-full py-4 rounded-xl text-[15px] font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-35"
                    style={{
                      background: copied ? "rgba(34,197,94,0.18)" : "rgba(177,235,11,0.12)",
                      border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(177,235,11,0.32)"}`,
                      color: copied ? "#86EFAC" : GOLD_LIGHT,
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5" strokeWidth={2.5} />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" strokeWidth={2} />
                        Copiar código PIX
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Botão de verificação manual */}
              {!confirmedPaid && !pixExpired && (
                <button
                  type="button"
                  disabled={checkingManually}
                  onClick={async () => {
                    if (!transactionId || checkingManually) return;
                    setCheckingManually(true);
                    try {
                      const r = await fetch(`/api/deposits/transactions/${transactionId}`, {
                        credentials: "include",
                        cache: "no-store",
                      });
                      const data = (await r.json()) as { transaction?: DepositTransaction };
                      if (r.ok && data.transaction) {
                        console.log("[PIX] verificação manual status:", data.transaction.status);
                        handleTransactionUpdate(
                          {
                            status: data.transaction.status,
                            pixQrcode: data.transaction.pixQrcode,
                            providerTransactionId: data.transaction.providerTransactionId,
                          },
                          "manual"
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
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3.5 text-[13px] font-bold text-white/70 transition-colors hover:bg-white/8 disabled:opacity-50"
                >
                  {checkingManually ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verificando…
                    </>
                  ) : (
                    <>
                      <Check className="size-4" strokeWidth={2.5} />
                      Já paguei — verificar agora
                    </>
                  )}
                </button>
              )}
              {error && (
                <p className="text-center text-[12px] font-semibold text-red-300">{error}</p>
              )}
            </div>
          )}
        </section>
      </div>
      )}
    </>
  );
}

