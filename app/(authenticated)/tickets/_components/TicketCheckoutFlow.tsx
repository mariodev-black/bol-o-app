"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import {
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Flame,
  Headphones,
  Loader2,
  Lock,
  ShieldCheck,
  Ticket,
  Trophy,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { appendTicketsFromPurchase } from "../lib/ownedTicketsStorage";

const GOLD = "#B1EB0B";
const GOLD_LIGHT = "#E8FF8A";
const CARD = "#101010";
const DEFAULT_PRINCIPAL_CENTS = 3990;
const DEFAULT_DIARIO_CENTS = 2000;
const DEFAULT_EXTRA_CENTS = 3990;
const RESERVATION_WINDOW_MS = 10 * 60 * 1000;
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
  initialPrincipalQty: number;
  initialDiarioQty: number;
};

export function TicketCheckoutFlow({ initialPrincipalQty, initialDiarioQty }: TicketCheckoutFlowProps) {
  const router = useRouter();
  const [principalQty, setPrincipalQty] = useState(initialPrincipalQty);
  const [diarioQty, setDiarioQty] = useState(initialDiarioQty);
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
  const [reservationDeadline] = useState(() => Date.now() + RESERVATION_WINDOW_MS);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
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

  const mainSelected = principalQty >= 1;
  const extraSelected = principalQty >= 2;
  const dailySelected = diarioQty >= 1;
  const selectedMode: TicketType = dailySelected ? "daily" : "general";
  const extraPrice = Math.min(prices.extra, prices.general);
  const principalLine = mainSelected ? prices.general + (extraSelected ? extraPrice : 0) : 0;
  const diarioLine = diarioQty * prices.daily;
  const totalCents = principalLine + diarioLine;
  const totalQty = principalQty + diarioQty;
  const hasSelection = totalCents > 0;
  const selectedQty = selectedMode === "general" ? principalQty : diarioQty;
  const reservationSecondsLeft = Math.max(0, Math.ceil((reservationDeadline - now) / 1000));
  const secondsLeft =
    step === "pix" && pixDeadline != null ? Math.max(0, Math.ceil((pixDeadline - now) / 1000)) : 0;
  const pixExpired = step === "pix" && pixDeadline != null && secondsLeft === 0;
  const pixProgressPct =
    step === "pix" && pixDeadline != null ? Math.min(100, Math.max(0, (secondsLeft / PIX_TOTAL_SEC) * 100)) : 0;

  const goGenerate = useCallback(() => {
    if (!hasSelection) return;
    if (selectedQty <= 0) {
      setError("Selecione uma cota para gerar o PIX.");
      return;
    }
    setError(null);
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
      <div
        className={
          step === "shop"
            ? "w-full max-w-[420px] mx-auto px-4 pb-10 pt-4 sm:px-6 sm:pt-10"
            : "w-full max-w-md mx-auto px-4 py-8 sm:px-6 sm:py-10 flex-1 flex flex-col justify-start"
        }
      >
        <section className="w-full">
          {step === "shop" && (
            <div className="space-y-[18px]">
              <div
                className="flex items-center justify-between gap-3 rounded-[13px] border px-4 py-3 shadow-[0_0_26px_rgba(249,115,22,0.18)]"
                style={{
                  background: "linear-gradient(180deg, rgba(120,53,15,0.58) 0%, rgba(29,18,8,0.94) 100%)",
                  borderColor: "rgba(249,115,22,0.42)",
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Flame className="size-[18px] shrink-0 text-[#FB923C]" strokeWidth={2.2} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-black uppercase leading-none tracking-[-0.02em] text-white">
                      Cotas sendo reservadas agora!
                    </p>
                    <p className="mt-1 text-[10px] font-bold leading-none text-[#FDBA74]">
                      Sua reserva expira em:
                    </p>
                  </div>
                </div>
                <div className="rounded-[9px] bg-[#F97316] px-3.5 py-2 shadow-[0_10px_28px_rgba(249,115,22,0.42)]">
                  <span className="font-mono text-[24px] font-black leading-none tracking-[-0.08em] text-white">
                    {formatCountdown(reservationSecondsLeft)}
                  </span>
                </div>
              </div>

              <section
                className="overflow-hidden rounded-[16px] border shadow-[0_18px_40px_rgba(0,0,0,0.38)]"
                style={{ background: "#101010", borderColor: "rgba(255,255,255,0.08)" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setDiarioQty(0);
                    setPrincipalQty((qty) => Math.max(1, qty));
                  }}
                  className="grid w-full grid-cols-[50px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary active:bg-white/5"
                >
                  <div className="flex size-[48px] items-center justify-center rounded-[11px] border" style={{ background: "rgba(177,235,11,0.09)", borderColor: "rgba(177,235,11,0.22)" }}>
                    <Trophy className="size-[23px] text-primary" strokeWidth={2.1} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-black leading-tight text-white">Cota Bolão da Copa 2026</p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium leading-none text-white/50">
                      <ShieldCheck className="size-3.5 text-[#0AC96B]" /> Acesso a todos os jogos
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium leading-none text-white/50">
                      <ShieldCheck className="size-3.5 text-[#0AC96B]" /> Top 10% premiados
                    </p>
                  </div>
                  <p className="text-[16px] font-black tabular-nums text-white">{formatBRL(prices.general)}</p>
                </button>

                <div className="mx-4 h-px bg-white/7" />

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setDiarioQty(0);
                    setPrincipalQty(extraSelected ? 1 : 2);
                  }}
                  className="grid w-full grid-cols-[50px_minmax(0,1fr)_40px] items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary active:bg-white/5"
                  aria-pressed={extraSelected}
                >
                  <div className="flex size-[48px] items-center justify-center rounded-[11px] border" style={{ background: "rgba(177,235,11,0.08)", borderColor: "rgba(177,235,11,0.18)" }}>
                    <Ticket className="size-[23px] text-primary" strokeWidth={2.1} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-black leading-none text-white">+1 Cota extra</p>
                      <span className="inline-flex h-[19px] items-center gap-1 rounded-[4px] bg-[#E33B20] px-2 text-[8px] font-black uppercase tracking-widest text-white">
                        <Flame className="size-2.5 fill-white" /> Mais vendido
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-medium leading-none text-white/42">Segunda combinação de palpites</p>
                    <p className="mt-2 text-[15px] font-black leading-none text-white">
                      <span className="mr-2 text-[11px] font-bold text-white/25 line-through">R$ 69,90</span>
                      {formatBRL(extraPrice)}
                    </p>
                  </div>
                  <span
                    className="flex size-[40px] items-center justify-center rounded-[9px] border transition-transform active:scale-95"
                    style={{
                      background: extraSelected ? GOLD : "rgba(255,255,255,0.02)",
                      borderColor: extraSelected ? "rgba(177,235,11,0.45)" : "rgba(177,235,11,0.24)",
                      boxShadow: extraSelected ? "0 0 22px rgba(177,235,11,0.45)" : "none",
                    }}
                  >
                    <Check className="size-5" style={{ color: extraSelected ? "#0E141B" : "rgba(177,235,11,0.22)" }} strokeWidth={3} />
                  </span>
                </button>

                <div className="mx-4 h-px bg-white/7" />

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    if (dailySelected) {
                      setDiarioQty(0);
                      setPrincipalQty(1);
                    } else {
                      setPrincipalQty(0);
                      setDiarioQty(1);
                    }
                  }}
                  className="grid w-full grid-cols-[50px_minmax(0,1fr)_40px] items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary active:bg-white/5"
                  aria-pressed={dailySelected}
                >
                  <div className="flex size-[48px] items-center justify-center rounded-[11px] border" style={{ background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.22)" }}>
                    <CalendarIcon />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-black leading-none text-white">Bolão do Dia</p>
                    <p className="mt-2 text-[11px] font-medium leading-none text-white/42">Prêmios extras todo dia da Copa</p>
                    <p className="mt-2 text-[15px] font-black leading-none text-white">
                      <span className="mr-2 text-[11px] font-bold text-white/25 line-through">R$ 29,90</span>
                      {formatBRL(prices.daily)}
                    </p>
                  </div>
                  <span
                    className="flex size-[40px] items-center justify-center rounded-[9px] border transition-transform active:scale-95"
                    style={{
                      background: dailySelected ? GOLD : "rgba(255,255,255,0.02)",
                      borderColor: dailySelected ? "rgba(177,235,11,0.45)" : "rgba(177,235,11,0.24)",
                      boxShadow: dailySelected ? "0 0 22px rgba(177,235,11,0.45)" : "none",
                    }}
                  >
                    <Check className="size-5" style={{ color: dailySelected ? "#0E141B" : "rgba(177,235,11,0.22)" }} strokeWidth={3} />
                  </span>
                </button>

                <div className="flex items-center justify-between border-t px-4 py-4" style={{ borderColor: "rgba(177,235,11,0.12)" }}>
                  <span className="text-[14px] font-black uppercase tracking-[0.18em] text-white/38">Total</span>
                  <span className="text-[28px] font-black leading-none tracking-[-0.08em] text-primary drop-shadow-[0_0_18px_rgba(177,235,11,0.35)]">
                    {formatBRL(totalCents)}
                  </span>
                </div>
              </section>

              <div className="grid grid-cols-4 gap-2">
                <TrustCard icon={Lock} title="Pagamento" subtitle="100% seguro" />
                <TrustCard icon={ShieldCheck} title="Confirmação" subtitle="automática" />
                <TrustCard icon={Zap} title="Acesso" subtitle="imediato" />
                <TrustCard icon={Headphones} title="Suporte" subtitle="WhatsApp" />
              </div>

              <section className="overflow-hidden rounded-[15px] border" style={{ background: "#101010", borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="border-b px-4 py-4" style={{ borderColor: "rgba(177,235,11,0.1)" }}>
                  <p className="text-[12px] font-black uppercase tracking-[0.2em] text-white/38">5. Forma de pagamento</p>
                </div>
                <div className="flex items-center gap-4 px-4 py-6">
                  <PixMark />
                  <div>
                    <p className="text-[18px] font-black uppercase leading-none text-white">Pague com Pix</p>
                    <p className="mt-2 text-[13px] font-semibold leading-none text-white/45">Aprovação imediata!</p>
                  </div>
                </div>
                <div className="border-t px-4 pb-5 pt-5" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <button
                    type="button"
                    disabled={!hasSelection}
                    onClick={goGenerate}
                    className="flex h-[67px] w-full items-center justify-center gap-3 rounded-[13px] bg-primary text-[14px] font-black uppercase tracking-[-0.02em] text-[#0E141B] shadow-[0_0_34px_rgba(177,235,11,0.45)] transition-transform hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Gerar Pix e garantir minha cota
                    <ArrowRight className="size-5" strokeWidth={3} />
                  </button>
                  <p className="mt-4 flex items-start justify-center gap-2 text-center text-[11px] font-medium leading-[1.55] text-white/36">
                    <Lock className="mt-0.5 size-3.5 shrink-0" />
                    Seu acesso será liberado automaticamente após a confirmação do pagamento.
                  </p>
                  {error && <p className="mt-3 text-center text-[12px] font-semibold text-red-300">{error}</p>}
                </div>
              </section>

              <div className="grid grid-cols-2 overflow-hidden rounded-[10px] border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3 px-4 py-4" style={{ background: "linear-gradient(90deg, rgba(13,82,50,0.58), rgba(5,33,24,0.96))" }}>
                  <div className="flex size-[38px] items-center justify-center rounded-[9px] border" style={{ background: "rgba(177,235,11,0.08)", borderColor: "rgba(177,235,11,0.2)" }}>
                    <UsersIcon />
                  </div>
                  <div>
                    <p className="text-[18px] font-black leading-none text-primary">+125 MIL</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Cotas vendidas</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-4" style={{ background: "linear-gradient(90deg, rgba(20,18,10,0.96), rgba(35,23,5,0.85))" }}>
                  <div className="flex size-[38px] items-center justify-center rounded-[9px] border" style={{ background: "rgba(230,183,38,0.08)", borderColor: "rgba(230,183,38,0.22)" }}>
                    <Clock3 className="size-[18px] text-[#E6B726]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-black uppercase leading-none text-[#E6B726]">Últimas vagas</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#E6B726]/70">Não fique de fora!</p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
    </>
  );
}


type TrustCardProps = {
  icon: typeof Lock;
  title: string;
  subtitle: string;
};

function TrustCard({ icon: Icon, title, subtitle }: TrustCardProps) {
  return (
    <div
      className="flex h-[92px] flex-col items-center justify-center rounded-[9px] border text-center shadow-[0_12px_24px_rgba(0,0,0,0.24)]"
      style={{ background: "#101010", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div
        className="mb-2 flex size-[31px] items-center justify-center rounded-[8px] border"
        style={{ background: "rgba(177,235,11,0.08)", borderColor: "rgba(177,235,11,0.2)" }}
        aria-hidden
      >
        <Icon className="size-[15px] text-primary" strokeWidth={2.1} />
      </div>
      <p className="text-[10px] font-black leading-none text-white">{title}</p>
      <p className="mt-1 text-[9px] font-semibold leading-none text-white/35">{subtitle}</p>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[23px]" aria-hidden>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" fill="none" stroke="#83B7FF" strokeWidth="1.8" />
      <path d="M8 3.8v4M16 3.8v4M4.5 10h15" stroke="#83B7FF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PixMark() {
  return (
    <div className="relative size-[45px] shrink-0 rotate-45 rounded-[10px] bg-[#38D6C6] shadow-[0_0_20px_rgba(56,214,198,0.18)]" aria-hidden>
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/35" />
      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/35" />
    </div>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[19px] text-primary" fill="none" aria-hidden>
      <path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19c.4-3.2 2.2-5 5-5s4.6 1.8 5 5M12.5 14.5c.7-.5 1.7-.8 3-.8 2.5 0 4.1 1.5 4.5 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
