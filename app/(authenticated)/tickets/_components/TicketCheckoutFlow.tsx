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
  Flame,
  Loader2,
  Lock,
  Shield,
  Ticket,
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
  const [ticketKind, setTicketKind] = useState<"general" | "daily">(
    initialTicketKind === "daily" ? "daily" : "general"
  );
  const [qty, setQty] = useState(1);
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
  const paidHandledRef = useRef(false);
  const purchasePrincipalRef = useRef(0);
  const purchaseDiarioRef = useRef(0);

  const handleTransactionUpdate = useCallback(
    (payload: TransactionUpdatePayload) => {
      if (payload.status) setTxStatus(payload.status);
      if (payload.pixQrcode) setPixPayload(payload.pixQrcode);
      if (payload.providerTransactionId) setOrderRef(payload.providerTransactionId);
      if (
        transactionId &&
        (payload.status === "paid" || payload.status === "approved") &&
        !paidHandledRef.current
      ) {
        paidHandledRef.current = true;
        appendTicketsFromPurchase(purchasePrincipalRef.current, purchaseDiarioRef.current);
        const q = new URLSearchParams({
          tx: transactionId,
          principal: String(purchasePrincipalRef.current),
          diario: String(purchaseDiarioRef.current),
        });
        router.replace(`/tickets/obrigado?${q.toString()}`);
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

  useEffect(() => {
    if (step !== "pix" || !transactionId) return;
    const es = new EventSource(`/api/deposits/transactions/${transactionId}/events`);
    es.addEventListener("transaction", (evt) => {
      try {
        const payload = JSON.parse((evt as MessageEvent).data) as {
          status?: string;
          pixQrcode?: string | null;
          providerTransactionId?: string | null;
        };
        handleTransactionUpdate(payload);
      } catch {
        // ignora payload invalido
      }
    });
    return () => es.close();
  }, [step, transactionId, handleTransactionUpdate]);

  useEffect(() => {
    if (step !== "pix" || !transactionId) return;
    let cancelled = false;

    async function pollTransaction() {
      try {
        const r = await fetch(`/api/deposits/transactions/${transactionId}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await r.json()) as { transaction?: DepositTransaction };
        if (cancelled || !r.ok || !data.transaction) return;
        handleTransactionUpdate({
          status: data.transaction.status,
          pixQrcode: data.transaction.pixQrcode,
          providerTransactionId: data.transaction.providerTransactionId,
        });
      } catch {
        // Mantem o SSE como canal principal e tenta novamente no proximo ciclo.
      }
    }

    void pollTransaction();
    const id = window.setInterval(pollTransaction, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, transactionId, handleTransactionUpdate]);

  const extraPrice = Math.min(prices.extra, prices.general);
  const principalLine =
    ticketKind === "general" ? (qty === 2 ? prices.general + extraPrice : qty * prices.general) : 0;
  const diarioLine = ticketKind === "daily" ? qty * prices.daily : 0;
  const totalCents = principalLine + diarioLine;
  const principalQty = ticketKind === "general" ? qty : 0;
  const diarioQty = ticketKind === "daily" ? qty : 0;
  const totalQty = qty;
  const hasSelection = totalCents > 0 && qty >= 1;
  const selectedMode: TicketType = ticketKind;
  const selectedQty = qty;
  const secondsLeft =
    step === "pix" && pixDeadline != null ? Math.max(0, Math.ceil((pixDeadline - now) / 1000)) : 0;
  const pixExpired = step === "pix" && pixDeadline != null && secondsLeft === 0;
  const pixProgressPct =
    step === "pix" && pixDeadline != null ? Math.min(100, Math.max(0, (secondsLeft / PIX_TOTAL_SEC) * 100)) : 0;

  const summaryTitle =
    ticketKind === "general"
      ? qty === 1
        ? "1 Ticket Geral"
        : `${qty} Tickets Gerais`
      : qty === 1
        ? "1 Ticket Diário"
        : `${qty} Tickets Diários`;
  const summarySubtitle =
    ticketKind === "general"
      ? "Todos os bolões da Copa do Milhão"
      : "Acesso exclusivo ao Bolão do dia.";

  const goGenerate = useCallback(() => {
    if (!hasSelection) return;
    if (selectedQty <= 0) {
      setError("Selecione uma cota para gerar o PIX.");
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
            ticketType: selectedMode,
            quantity: selectedQty,
            amountCents: totalCents,
          }),
        });
        const d = (await r.json()) as { error?: string; transaction?: DepositTransaction };
        if (!r.ok || !d.transaction || !d.transaction.pixQrcode) {
          setError(d.error ?? "Nao foi possivel gerar o PIX.");
          setStep("shop");
          return;
        }
        purchasePrincipalRef.current = selectedMode === "general" ? selectedQty : 0;
        purchaseDiarioRef.current = selectedMode === "daily" ? selectedQty : 0;
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
  }, [hasSelection, selectedMode, selectedQty, totalCents]);

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
                    Escolha quantos tickets deseja adquirir.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1">
                <Shield className="size-3.5 text-primary" strokeWidth={2.2} />
                <span className="text-[10px] font-black uppercase tracking-wide text-primary">Seguro</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCouponHint(null);
                  if (ticketKind !== "general") setQty(1);
                  setTicketKind("general");
                }}
                className={
                  ticketKind === "general"
                    ? "relative flex min-h-[104px] w-full min-w-0 flex-col overflow-hidden rounded-[14px] border-2 border-primary bg-[#121212]/95 p-2.5 text-left shadow-[0_0_22px_rgba(177,235,11,0.2)] outline-none ring-1 ring-primary/20 backdrop-blur-[2px] transition-transform active:scale-[0.99] sm:min-h-[112px] sm:rounded-[16px] sm:p-3"
                    : "relative flex min-h-[104px] w-full min-w-0 flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#121212] p-2.5 text-left outline-none transition-transform active:scale-[0.99] sm:min-h-[112px] sm:rounded-[16px] sm:p-3"
                }
              >
                {ticketKind === "general" && (
                  <span className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-[#0E141B] shadow-lg sm:right-2 sm:top-2 sm:size-6">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
                <div className="flex w-full min-w-0 flex-row items-center gap-2 pt-5 sm:gap-2.5 sm:pt-6">
                  <img
                    src={ticketGold.src}
                    alt=""
                    className="h-[65px] w-[48px] shrink-0 object-contain drop-shadow-[0_8px_24px_rgba(177,235,11,0.35)] sm:h-[88px] sm:w-[64px]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-5 sm:gap-1 sm:pr-7">
                    <p
                      className={
                        ticketKind === "general"
                          ? "text-[14px] font-black whitespace-nowrap leading-tight text-primary sm:text-[13px]"
                          : "text-[14px] font-black whitespace-nowrap leading-tight text-white sm:text-[13px]"
                      }
                    >
                      Ticket Geral
                    </p>
                    <p className="text-[10px] font-medium leading-snug text-white/40 sm:text-[10px]">
                      Acesso a todas as rodadas da Copa do Milhão
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCouponHint(null);
                  if (ticketKind !== "daily") setQty(1);
                  setTicketKind("daily");
                }}
                className={
                  ticketKind === "daily"
                    ? "relative flex min-h-[104px] w-full min-w-0 flex-col overflow-hidden rounded-[14px] border-2 border-primary bg-[#121212]/95 p-2.5 text-left shadow-[0_0_22px_rgba(177,235,11,0.2)] outline-none ring-1 ring-primary/20 backdrop-blur-[2px] transition-transform active:scale-[0.99] sm:min-h-[112px] sm:rounded-[16px] sm:p-3"
                    : "relative flex min-h-[104px] w-full min-w-0 flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#121212] p-2.5 text-left outline-none transition-transform active:scale-[0.99] sm:min-h-[112px] sm:rounded-[16px] sm:p-3"
                }
              >
                {ticketKind === "daily" && (
                  <span className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-[#0E141B] shadow-lg sm:right-2 sm:top-2 sm:size-6">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
                <div className="flex w-full min-w-0 flex-row items-center gap-2 pt-5 sm:gap-2.5 sm:pt-6">
                  <img
                    src={ticketBlue.src}
                    alt=""
                    className={
                      ticketKind === "daily"
                        ? "h-[65px] w-[48px] shrink-0 object-contain drop-shadow-[0_8px_24px_rgba(59,130,246,0.45)] sm:h-[88px] sm:w-[64px]"
                        : "h-[65px] w-[48px] shrink-0 object-contain opacity-55 grayscale sm:h-[88px] sm:w-[64px]"
                    }
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-5 sm:gap-1 sm:pr-7">
                    <p
                      className={
                        ticketKind === "daily"
                          ? "text-[14px] font-black whitespace-nowrap leading-tight text-primary sm:text-[13px]"
                          : "text-[14px] font-black whitespace-nowrap leading-tight text-white sm:text-[13px]"
                      }
                    >
                      Ticket Diário
                    </p>
                    <p className="text-[10px] font-medium leading-snug text-white/40 sm:text-[10px]">
                      Acesso exclusivo ao Bolão do dia.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* ── Resumo da compra ─────────────────────────────── */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-[18px] w-[3px] rounded-full bg-primary" aria-hidden />
                  <h3 className="text-[15px] font-black tracking-tight text-white">Resumo da compra</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setCouponOpen((o) => !o); setCouponHint(null); }}
                  className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline"
                >
                  <Ticket className="size-3.5" strokeWidth={2.2} />
                  Possui cupom?
                </button>
              </div>

              {couponOpen && (
                <div className="mb-3 flex flex-col gap-2 rounded-[12px] border border-white/10 bg-[#121212] p-3">
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
                      if (!t) { setCouponHint("Digite um código."); return; }
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

              {/* card do stepper */}
              <div className="flex items-center gap-4 rounded-[16px] border border-white/8 bg-[#171717] px-2 py-2">
                {/* stepper horizontal */}
                <div className="flex shrink-0 items-center gap-1 rounded-[12px] border border-white/10 bg-[#0f0f0f] p-1.5">
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-white/6 text-white/60 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-30"
                  >
                    <ChevronDown className="size-[18px]" strokeWidth={2.5} />
                  </button>
                  <span className="w-8 text-center text-[20px] font-black tabular-nums text-white">{qty}</span>
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    disabled={qty >= MAX_QTY}
                    onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-white/6 text-white/60 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-30"
                  >
                    <ChevronUp className="size-[18px]" strokeWidth={2.5} />
                  </button>
                </div>

                {/* título + subtítulo */}
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-black leading-tight text-white">{summaryTitle}</p>
                  <p className="mt-1 text-[10px] font-medium leading-snug text-white/40">{summarySubtitle}</p>
                </div>

                {/* preço */}
                <span className="shrink-0 text-[14px] font-black tabular-nums text-primary">
                  {formatBRL(totalCents)}
                </span>
              </div>
            </div>

            {/* ── Benefícios ───────────────────────────────────── */}
            <div className="space-y-[14px] rounded-[16px] border border-white/8 bg-[#171717] px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
                  <Check className="size-3.5 text-primary" strokeWidth={3} />
                </span>
                <p className="text-[11px] leading-snug text-white/80">
                  <span className="font-black text-white">Oferta exclusiva!</span>{" "}
                  Use os tickets nos melhores bolões
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
                  <Check className="size-3.5 text-primary" strokeWidth={3} />
                </span>
                <p className="text-[11px] leading-snug text-white/80">
                  <span className="font-black text-white">Aproveite e concorra</span>{" "}
                  a prêmios de até R$ 1.000.000
                </p>
              </div>
            </div>

            {/* ── Trust bar ────────────────────────────────────── */}
            <div className="flex items-center justify-center gap-6 py-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/35">
                <Shield className="size-[12px] shrink-0" strokeWidth={1.8} />
                100% Seguro
              </span>
              <span className="h-3 w-px bg-white/12" aria-hidden />
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/35">
                <Zap className="size-[12px] shrink-0" strokeWidth={1.8} />
                Instantâneo
              </span>
              <span className="h-3 w-px bg-white/12" aria-hidden />
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/35">
                <Check className="size-[12px] shrink-0" strokeWidth={2.4} />
                Sem taxas
              </span>
            </div>

            {/* ── Botão depositar ──────────────────────────────── */}
            <button
              type="button"
              disabled={!hasSelection}
              onClick={goGenerate}
              className="flex h-[62px] w-full items-center justify-center gap-3 rounded-[16px] bg-primary px-5 text-[15px] font-black uppercase tracking-[0.04em] text-[#0E141B] shadow-[0_4px_32px_rgba(177,235,11,0.55)] transition-[transform,filter] hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Wallet className="size-5 shrink-0" strokeWidth={2.2} />
              <span>Depositar {formatBRL(totalCents)}</span>
              <ArrowRight className="size-5 shrink-0" strokeWidth={2.8} />
            </button>
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

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/45">PIX</span>
                  <span className="text-[12px] font-mono text-white/55">{orderRef}</span>
                </div>
                <div className="flex items-center justify-between text-[13px] mb-1.5" style={{ color: "rgba(226,213,184,0.55)" }}>
                  <span>{pixExpired ? "Expirado" : "Válido 5 min"}</span>
                  <span className="font-mono tabular-nums text-white/65">{pixExpired ? "0:00" : formatCountdown(secondsLeft)}</span>
                </div>
                <p className="text-[12px] text-white/50 mt-1">
                  Status: <span className="text-white/80 font-semibold">{statusLabelPt(txStatus || "waiting_payment")}</span>
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
                          {formatBRL(principalLine)}
                        </span>
                      </div>
                    )}
                    {diarioQty > 0 && (
                      <div className="flex justify-between gap-2 text-white/65">
                        <span>
                          <span className="font-mono text-white">{diarioQty}×</span> Diário
                          <span className="text-white/35 font-normal"> @ {formatBRL(prices.daily)}</span>
                        </span>
                        <span className="tabular-nums font-medium" style={{ color: GOLD_LIGHT }}>
                          {formatBRL(diarioLine)}
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
            </div>
          )}
        </section>
      </div>
      )}
    </>
  );
}

