"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "react-qr-code";
import { TicketPurchaseBanner } from "./TicketPurchaseBanner";
import { MyTicketsWallet } from "./MyTicketsWallet";
import { Check, Copy, Loader2, Minus, Plus, Ticket } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { useRouter } from "next/navigation";
import ticketGold from "@/app/assets/ticket-gold.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import { appendTicketsFromPurchase } from "../lib/ownedTicketsStorage";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#FFE8BA";
const CARD = "#0A0E19";
const DEFAULT_PRINCIPAL_CENTS = 5000;
const DEFAULT_DIARIO_CENTS = 2500;
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

type TicketCheckoutFlowProps = {
  initialPrincipalQty: number;
  initialDiarioQty: number;
};

export function TicketCheckoutFlow({ initialPrincipalQty, initialDiarioQty }: TicketCheckoutFlowProps) {
  const router = useRouter();
  const [principalQty, setPrincipalQty] = useState(initialPrincipalQty);
  const [diarioQty, setDiarioQty] = useState(initialDiarioQty);
  const [prices, setPrices] = useState({ general: DEFAULT_PRINCIPAL_CENTS, daily: DEFAULT_DIARIO_CENTS });
  const [step, setStep] = useState<FlowStep>("shop");
  const [orderRef, setOrderRef] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>("");
  const [pixPayload, setPixPayload] = useState("");
  const [copied, setCopied] = useState(false);
  const [pixDeadline, setPixDeadline] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [walletVersion, setWalletVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const paidHandledRef = useRef(false);
  const purchasePrincipalRef = useRef(0);
  const purchaseDiarioRef = useRef(0);

  useEffect(() => {
    setPrincipalQty(initialPrincipalQty);
    setDiarioQty(initialDiarioQty);
  }, [initialPrincipalQty, initialDiarioQty]);

  useEffect(() => {
    if (step === "generating" || step === "pix") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [step]);

  useEffect(() => {
    if (step !== "pix" || !pixDeadline) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [step, pixDeadline]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/deposits/transactions", { credentials: "include" });
        const d = (await r.json()) as { prices?: { general: number; daily: number } };
        if (r.ok && d.prices) {
          setPrices({ general: d.prices.general, daily: d.prices.daily });
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
        if (payload.status) setTxStatus(payload.status);
        if (payload.pixQrcode) setPixPayload(payload.pixQrcode);
        if (payload.providerTransactionId) setOrderRef(payload.providerTransactionId);
        if ((payload.status === "paid" || payload.status === "approved") && !paidHandledRef.current) {
          paidHandledRef.current = true;
          appendTicketsFromPurchase(purchasePrincipalRef.current, purchaseDiarioRef.current);
          setWalletVersion((v) => v + 1);
          const q = new URLSearchParams({
            tx: transactionId,
            principal: String(purchasePrincipalRef.current),
            diario: String(purchaseDiarioRef.current),
          });
          router.replace(`/tickets/obrigado?${q.toString()}`);
        }
      } catch {
        // ignora payload invalido
      }
    });
    return () => es.close();
  }, [step, transactionId, router]);

  const principalLine = principalQty * prices.general;
  const diarioLine = diarioQty * prices.daily;
  const totalCents = principalLine + diarioLine;
  const totalQty = principalQty + diarioQty;
  const hasSelection = totalCents > 0;
  const selectedType: TicketType | null =
    principalQty > 0 && diarioQty === 0 ? "general" : diarioQty > 0 && principalQty === 0 ? "daily" : null;
  const selectedQty = selectedType === "general" ? principalQty : selectedType === "daily" ? diarioQty : 0;
  const purchasePrincipalQty = selectedType === "general" ? selectedQty : 0;
  const purchaseDiarioQty = selectedType === "daily" ? selectedQty : 0;

  const secondsLeft =
    step === "pix" && pixDeadline != null ? Math.max(0, Math.ceil((pixDeadline - Date.now()) / 1000)) : 0;
  const pixExpired = step === "pix" && pixDeadline != null && secondsLeft === 0;
  const pixProgressPct =
    step === "pix" && pixDeadline != null ? Math.min(100, Math.max(0, (secondsLeft / PIX_TOTAL_SEC) * 100)) : 0;

  const bump = (which: "p" | "d", delta: number) => {
    setError(null);
    if (which === "p") setPrincipalQty((q) => Math.max(0, Math.min(20, q + delta)));
    else setDiarioQty((q) => Math.max(0, Math.min(20, q + delta)));
  };

  const goGenerate = useCallback(() => {
    if (!hasSelection) return;
    if (!selectedType) {
      setError("Para pagar com PIX agora, selecione somente um tipo de ticket por vez (Geral ou Diario).");
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
            ticketType: selectedType,
            quantity: selectedQty,
          }),
        });
        const d = (await r.json()) as { error?: string; transaction?: DepositTransaction };
        if (!r.ok || !d.transaction || !d.transaction.pixQrcode) {
          setError(d.error ?? "Nao foi possivel gerar o PIX.");
          setStep("shop");
          return;
        }
        purchasePrincipalRef.current = selectedType === "general" ? selectedQty : 0;
        purchaseDiarioRef.current = selectedType === "daily" ? selectedQty : 0;
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
  }, [hasSelection, selectedQty, selectedType]);

  const copyPix = useCallback(() => {
    if (!pixPayload || pixExpired) return;
    void navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }, [pixPayload, pixExpired]);

  const resetFlow = () => {
    paidHandledRef.current = false;
    purchasePrincipalRef.current = 0;
    purchaseDiarioRef.current = 0;
    setStep("shop");
    setPixPayload("");
    setOrderRef("");
    setTransactionId(null);
    setTxStatus("");
    setCopied(false);
    setPixDeadline(null);
  };


  return (
    <>
      {step === "shop" && <TicketPurchaseBanner />}

      <div
        className={
          step === "shop"
            ? "w-full max-w-2xl mx-auto px-4 pb-10 pt-0 sm:px-6"
            : "w-full max-w-md mx-auto px-4 py-8 sm:px-6 sm:py-10 flex-1 flex flex-col justify-start"
        }
      >
        <section className="w-full">
          {step === "shop" && (
            <div className="space-y-5">
              <MyTicketsWallet refreshKey={walletVersion} />

              <div className="relative pl-3 sm:pl-4" style={{ borderLeft: `2px solid ${GOLD}` }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] mb-1" style={{ color: "rgba(218,182,130,0.8)" }}>
                  Palpites
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight" style={{ fontFamily: montserrat }}>
                  Tickets
                </h2>
                <p className="text-[14px] sm:text-[15px] mt-2 max-w-md leading-relaxed" style={{ color: "rgba(226,213,184,0.5)" }}>
                  Compre com PIX. Geral = palpites em toda a Copa. Diário = você escolhe o dia na hora de palpitar.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TicketTypeCard
                  productLabel="Copa inteira"
                  title="Geral"
                  description="Palpites em todas as rodadas. Conta para o ranking principal."
                  priceCents={prices.general}
                  qty={principalQty}
                  onDelta={(d) => bump("p", d)}
                  chip="Principal"
                  iconSrc={ticketGold}
                />
                <TicketTypeCard
                  productLabel="Um dia"
                  title="Diário"
                  description="Válido só no dia que você escolher ao abrir os palpites."
                  priceCents={prices.daily}
                  qty={diarioQty}
                  onDelta={(d) => bump("d", d)}
                  iconSrc={ticketBlue}
                />
              </div>

              <div
                className="rounded-xl p-3 sm:p-4"
                style={{
                  background: `linear-gradient(178deg, rgba(18,22,34,0.98) 0%, ${CARD} 100%)`,
                  border: "1px solid rgba(212,175,55,0.2)",
                }}
              >
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-white/40">Resumo · PIX</span>
                  <span className="text-2xl font-black tabular-nums" style={{ color: GOLD_LIGHT }}>
                    {formatBRL(totalCents)}
                  </span>
                </div>

                <p className="text-[13px] leading-relaxed mb-3" style={{ color: "rgba(226,213,184,0.48)" }}>
                  Geral {formatBRL(prices.general)} · Diário {formatBRL(prices.daily)} · à vista no PIX. Os tickets
                  aparecem na sua conta e você gasta ao palpitar.
                </p>

                <div className="space-y-2 text-[14px]">
                  {principalQty > 0 && (
                    <div className="flex justify-between gap-2 text-white/65">
                      <span>
                        <span className="font-mono text-white">{principalQty}×</span> Geral
                        <span className="text-white/35 font-normal"> @ {formatBRL(prices.general)}</span>
                      </span>
                      <span className="tabular-nums font-semibold" style={{ color: GOLD_LIGHT }}>
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
                      <span className="tabular-nums font-semibold" style={{ color: GOLD_LIGHT }}>
                        {formatBRL(diarioLine)}
                      </span>
                    </div>
                  )}
                  {!hasSelection && (
                    <p className="text-[14px] py-0.5" style={{ color: "rgba(226,213,184,0.45)" }}>
                      Escolha quantidades nos cards acima.
                    </p>
                  )}
                  {hasSelection && (
                    <p className="text-[13px] pt-0.5" style={{ color: "rgba(218,182,130,0.5)" }}>
                      {totalQty} ticket{totalQty === 1 ? "" : "s"} no pedido
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={goGenerate}
                  className="mt-4 w-full py-3.5 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-[0.12em] flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
                  style={{
                    fontFamily: montserrat,
                    color: "#0E141B",
                    background: hasSelection
                      ? `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 50%, #B8860B 100%)`
                      : "rgba(255,255,255,0.1)",
                    boxShadow: hasSelection ? "0 6px 24px rgba(212,175,55,0.22)" : "none",
                  }}
                >
                  <Ticket className="w-[18px] h-[18px]" strokeWidth={2.2} />
                  {hasSelection ? `Pagar ${totalQty} ticket${totalQty === 1 ? "" : "s"}` : "Escolha tickets"}
                </button>
                {error && (
                  <p className="mt-3 text-[12px] font-medium" style={{ color: "#FCA5A5" }}>
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "generating" && (
            <div
              className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl"
              style={{
                border: "1px solid rgba(212,175,55,0.18)",
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
                      background: copied ? "rgba(34,197,94,0.18)" : "rgba(212,175,55,0.12)",
                      border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(212,175,55,0.32)"}`,
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

function TicketTypeCard({
  productLabel,
  title,
  description,
  priceCents,
  qty,
  onDelta,
  iconSrc,
  chip,
}: {
  productLabel: string;
  title: string;
  description: string;
  priceCents: number;
  qty: number;
  onDelta: (d: number) => void;
  iconSrc: StaticImageData;
  chip?: string;
}) {
  const active = qty > 0;
  const iconWrap = {
    background: "rgba(212,175,55,0.11)",
    border: "1px solid rgba(212,175,55,0.32)",
  } as const;

  return (
    <div
      className="relative rounded-2xl p-5 sm:p-6 flex flex-col h-full min-h-[250px] transition-all duration-200"
      style={{
        background: `linear-gradient(168deg, rgba(11,15,26,0.99) 0%, ${CARD} 100%)`,
        border: active ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.07)",
        boxShadow: active
          ? `0 14px 44px rgba(0,0,0,0.48), 0 0 36px rgba(212,175,55,0.1)`
          : "0 6px 24px rgba(0,0,0,0.28)",
      }}
    >
      {chip && (
        <span
          className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded"
          style={{
            background: "rgba(212,175,55,0.14)",
            border: "1px solid rgba(212,175,55,0.32)",
            color: "rgba(255,232,186,0.88)",
          }}
        >
          {chip}
        </span>
      )}

      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
        style={{ color: "rgba(218,182,130,0.75)" }}
      >
        {productLabel}
      </p>

      <div className="flex gap-4 pr-12">
        <div className="w-[76px] h-[76px] rounded-xl flex items-center justify-center shrink-0" style={iconWrap}>
          <Image src={iconSrc} alt="" aria-hidden className="w-[82px] h-auto max-w-none drop-shadow-[0_14px_26px_rgba(0,0,0,0.4)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white text-[18px] leading-tight" style={{ fontFamily: montserrat }}>
            {title}
          </h3>
          <p className="text-[13px] sm:text-[14px] mt-2 leading-relaxed" style={{ color: "rgba(226,213,184,0.55)" }}>
            {description}
          </p>
          <p className="text-[17px] font-bold mt-3 tabular-nums" style={{ color: GOLD_LIGHT }}>
            {formatBRL(priceCents)}
            <span className="text-[11px] font-medium ml-1" style={{ color: "rgba(226,213,184,0.42)" }}>
              cada
            </span>
          </p>
        </div>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/8">
        <span className="text-[13px] font-medium" style={{ color: "rgba(226,213,184,0.5)" }}>
          Quantidade
        </span>
        <div
          className="inline-flex items-stretch rounded-lg overflow-hidden"
          style={{
            border: `1px solid ${active ? "rgba(212,175,55,0.42)" : "rgba(255,255,255,0.09)"}`,
            background: "rgba(0,0,0,0.38)",
          }}
        >
          <button
            type="button"
            onClick={() => onDelta(-1)}
            className="w-10 h-10 flex items-center justify-center text-white/65 hover:bg-white/6 transition-colors"
            aria-label={`Menos ${title}`}
          >
            <Minus className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <span className="min-w-[40px] flex items-center justify-center font-mono text-base font-bold text-white border-x border-white/10">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => onDelta(1)}
            className="w-10 h-10 flex items-center justify-center text-white/65 hover:bg-white/6 transition-colors"
            aria-label={`Mais ${title}`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
