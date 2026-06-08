"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, Trophy, Calendar, Users, ArrowRight, Check } from "lucide-react";
import iconCopaMundo2 from "@/app/assets/icon-copa-mundo2.png";
import { TicketPixGeneratedScreen } from "@/app/(authenticated)/tickets/_components/pix/TicketPixGeneratedScreen";
import { TicketPixGeneratingPanel } from "@/app/(authenticated)/tickets/_components/pix/TicketPixGeneratingPanel";
import {
  PIX_CHECKOUT_TOTAL_SEC,
  PIX_CHECKOUT_WINDOW_MS,
} from "@/app/(authenticated)/tickets/_components/pix/ticket-pix-ui-constants";
import { appendTicketsFromPurchase } from "@/app/(authenticated)/tickets/lib/ownedTicketsStorage";
import BolaoLogo from "@/app/assets/logo.png";
import {
  getComprarCotasBundleOptions,
  getComprarCotasPromoUnitCents,
  getTicketPriceCents,
} from "@/lib/payments/ticket-config";

const GREEN = "#B1EB0B";
const GOLD = "#FFD700";
const FONT = "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif";

type OptionId = 1 | 2 | 3;
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

const PROMO_DISCOUNT_PER_UNIT_CENTS =
  getTicketPriceCents("general") - getComprarCotasPromoUnitCents();

const OPTIONS = [
  {
    ...getComprarCotasBundleOptions()[0]!,
    label: "COTA",
    description: "Sua entrada oficial",
    badge: null as string | null,
  },
  {
    ...getComprarCotasBundleOptions()[1]!,
    label: "COTAS",
    description: "Mais chances do milhão",
    badge: "MAIS VENDIDO",
  },
  {
    ...getComprarCotasBundleOptions()[2]!,
    label: "COTAS",
    description: "Máxima chance de premiação",
    badge: null,
  },
] as const;

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function isPaidStatus(s: string): boolean {
  const v = (s || "").toLowerCase().trim();
  return (
    v === "paid" || v === "approved" || v === "completed" || v === "confirmed"
  );
}

const STATS = [
  {
    icon: <Trophy className="size-4 shrink-0" strokeWidth={2} />,
    main: "+ DE R$ 1 MILHÃO",
    sub: "EM PRÊMIOS",
  },
  {
    icon: <Calendar className="size-4 shrink-0" strokeWidth={2} />,
    main: "TODOS OS 104",
    sub: "JOGOS",
  },
  {
    icon: <Users className="size-4 shrink-0" strokeWidth={2} />,
    main: "OS 10% MELHORES",
    sub: "GANHAM",
  },
];

function ShopScreen({
  selected,
  onSelect,
  onContinue,
  error,
}: {
  selected: OptionId;
  onSelect: (id: OptionId) => void;
  onContinue: () => void;
  error: string | null;
}) {
  const selectedOption = OPTIONS.find((o) => o.id === selected)!;

  return (
    <div
      className="flex w-full flex-col items-center bg-[#0a0a0a] px-4 py-2 pb-6"
      style={{ fontFamily: FONT }}
    >
      <div className="flex w-full max-w-[390px] flex-col">
        {/* ── HEADER ── */}
        <div className=" flex items-center justify-between">
          <Image
            src={BolaoLogo}
            alt="Logo bolao"
            width={220}
            height={26}
            className="object-contain"
            draggable={false}
          />
          <Image
            src={iconCopaMundo2}
            alt="FIFA World Cup 2026"
            width={52}
            height={44}
            className="object-contain"
            draggable={false}
          />
        </div>

        {/* ── STATS BAR ── */}
        <div className="mb-2 flex overflow-hidden rounded-xl bg-[#111] py-2.5">
          {STATS.map((s, i) => (
            <div
              key={s.sub}
              className={`flex flex-1 flex-col items-center gap-1 px-2 text-center ${
                i > 0 ? "border-l border-white/8" : ""
              }`}
            >
              <span style={{ color: GREEN }}>{s.icon}</span>
              <p className="text-[9px] font-black uppercase leading-tight tracking-wide text-white/80">
                {s.main}
              </p>
              <p className="text-[8px] font-bold uppercase leading-none tracking-wide text-white/40">
                {s.sub}
              </p>
            </div>
          ))}
        </div>

        {/* ── SECTION TITLE ── */}
        <p className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-white/45">
          Escolha suas cotas
        </p>

        {/* ── OPTIONS ── */}
        <div className="mb-2 flex flex-col gap-2">
          {OPTIONS.map((opt) => {
            const active = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(opt.id)}
                className="relative flex w-full flex-col overflow-hidden rounded-2xl text-left transition-all"
                style={{
                  background: "#111",
                  border: active
                    ? `2px solid ${GREEN}`
                    : "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {opt.badge ? (
                  <span
                    className="absolute left-14 top-1.5 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-[3px] text-[7px] font-black uppercase tracking-wide text-[#0E141B]"
                    style={{ background: GREEN }}
                  >
                    ★ {opt.badge}
                  </span>
                ) : null}

                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Radio */}
                  <div
                    className="flex size-[20px] shrink-0 items-center justify-center rounded-full border-2 transition-all"
                    style={{
                      borderColor: active ? GREEN : "rgba(255,255,255,0.25)",
                    }}
                  >
                    {active && (
                      <div
                        className="size-[9px] rounded-full"
                        style={{ background: GREEN }}
                      />
                    )}
                  </div>

                  {/* Qty */}
                  <div className="flex w-7 shrink-0 flex-col items-center">
                    <span
                      className="text-[26px] font-black leading-none"
                      style={{ color: active ? GREEN : "white" }}
                    >
                      {opt.qty}
                    </span>
                    <span
                      className="text-[9px] font-black uppercase leading-none tracking-wider"
                      style={{
                        color: active ? `${GREEN}cc` : "rgba(255,255,255,0.45)",
                      }}
                    >
                      {opt.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="min-w-0 flex-1 text-[11px] font-bold uppercase leading-tight text-white/65">
                    {opt.description}
                  </p>

                  {/* Price */}
                  <div className="ml-1 shrink-0 text-right">
                    {opt.originalCents ? (
                      <p className="text-[10px] font-medium leading-snug text-white/30 line-through">
                        {fmt(opt.originalCents)}
                      </p>
                    ) : null}
                    <p className="text-[15px] font-black leading-tight text-white">
                      {fmt(opt.priceCents)}
                    </p>
                    {opt.savingsCents ? (
                      <span
                        className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide"
                        style={{ background: `${GREEN}1a`, color: GREEN }}
                      >
                        ECONOMIZE {fmt(opt.savingsCents)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── CUPOM ── */}
        <div
          className="mb-2 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5"
          style={{
            borderColor: `${GREEN}40`,
            background: `${GREEN}0d`,
            borderStyle: "dashed",
          }}
        >
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">
              Cupom aplicado
            </p>
            <p
              className="text-[13px] font-black leading-tight"
              style={{ color: GREEN }}
            >
              −R$ {(PROMO_DISCOUNT_PER_UNIT_CENTS / 100).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              <span className="text-[11px] font-semibold text-white/55">
                por cota
              </span>
            </p>
          </div>
          <div
            className="flex size-[26px] shrink-0 items-center justify-center rounded-full"
            style={{
              background: `${GREEN}22`,
              border: `1.5px solid ${GREEN}66`,
            }}
          >
            <Check
              className="size-3.5"
              strokeWidth={3}
              style={{ color: GREEN }}
            />
          </div>
        </div>

        {/* ── RESUMO DO PEDIDO ── */}
        <div className="mb-1 rounded-2xl border border-white/10 bg-[#111] px-4 py-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Resumo do Pedido
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold leading-snug text-white/65">
              {selectedOption.qty} {selectedOption.label.toLowerCase()} — Bolão
              do Milhão
            </p>
            <p className="shrink-0 text-[14px] font-black text-white">
              {fmt(selectedOption.priceCents)}
            </p>
          </div>
          <div
            className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2.5"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <p className="text-[14px] font-black uppercase tracking-wide text-white">
              Total
            </p>
            <p
              className="text-[22px] font-black leading-none"
              style={{ color: GREEN }}
            >
              {fmt(selectedOption.priceCents)}
            </p>
          </div>
        </div>

        {/* ── CTA ── */}
        <button
          type="button"
          onClick={onContinue}
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full text-[14px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
          style={{ background: GREEN }}
        >
          <Lock className="size-4 shrink-0" strokeWidth={2.5} />
          Garantir Minhas Cotas
          <ArrowRight className="size-4 shrink-0" strokeWidth={2.5} />
        </button>

        {error && (
          <p className="mt-2 text-center text-[11px] font-semibold text-red-300">
            {error}
          </p>
        )}

        <p className="mt-2 text-center text-[10px] font-medium text-white/25">
          Ambiente 100% seguro.
        </p>
      </div>
    </div>
  );
}

export default function ComprarCotasPage() {
  const router = useRouter();
  const [step, setStep] = useState<FlowStep>("shop");
  const [selected, setSelected] = useState<OptionId>(2);

  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState("");
  const [pixDeadline, setPixDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [checkingManually, setCheckingManually] = useState(false);
  const [confirmedPaid, setConfirmedPaid] = useState(false);

  const paidHandledRef = useRef(false);
  const purchasedQtyRef = useRef(1);

  const selectedOption = OPTIONS.find((o) => o.id === selected)!;

  useEffect(() => {
    if (step !== "shop") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [step]);

  useEffect(() => {
    if (step !== "pix") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [step]);

  const secondsLeft =
    step === "pix" && pixDeadline != null
      ? Math.max(0, Math.ceil((pixDeadline - now) / 1000))
      : 0;
  const pixExpired = step === "pix" && pixDeadline != null && secondsLeft === 0;
  const pixProgressPct =
    step === "pix" && pixDeadline != null
      ? Math.min(100, Math.max(0, (secondsLeft / PIX_CHECKOUT_TOTAL_SEC) * 100))
      : 0;

  const handleTransactionUpdate = useCallback(
    (payload: TransactionUpdatePayload) => {
      if (payload.pixQrcode) setPixPayload(payload.pixQrcode);
      if (
        transactionId &&
        payload.status &&
        isPaidStatus(payload.status) &&
        !paidHandledRef.current
      ) {
        paidHandledRef.current = true;
        setConfirmedPaid(true);
        appendTicketsFromPurchase(purchasedQtyRef.current, 0, {});
        const q = new URLSearchParams({
          tx: transactionId,
          principal: String(purchasedQtyRef.current),
          diario: "0",
        });
        window.setTimeout(() => {
          router.replace(`/tickets/obrigado?${q.toString()}`);
        }, 1500);
      }
    },
    [router, transactionId],
  );

  // SSE listener
  useEffect(() => {
    if (step !== "pix" || !transactionId) return;
    const es = new EventSource(
      `/api/deposits/transactions/${transactionId}/events`,
    );
    es.addEventListener("transaction", (evt) => {
      try {
        const payload = JSON.parse(
          (evt as MessageEvent).data,
        ) as TransactionUpdatePayload;
        handleTransactionUpdate(payload);
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

    async function poll() {
      if (paidHandledRef.current) return;
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
        });
      } catch {
        // ignore
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, transactionId, handleTransactionUpdate]);

  const goGenerate = useCallback(() => {
    setError(null);
    setStep("generating");
    purchasedQtyRef.current = selectedOption.qty;

    void (async () => {
      try {
        const r = await fetch("/api/deposits/transactions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generalQuantity: selectedOption.qty,
            dailyQuantity: 0,
            extraByChampionship: {},
            checkoutPromo: "comprar-cotas",
          }),
        });
        const d = (await r.json()) as {
          error?: string;
          transaction?: DepositTransaction;
        };
        if (!r.ok || !d.transaction?.pixQrcode) {
          setError(d.error ?? "Não foi possível gerar o PIX.");
          setStep("shop");
          return;
        }
        setTransactionId(d.transaction.id);
        setPixPayload(d.transaction.pixQrcode);
        setPixDeadline(Date.now() + PIX_CHECKOUT_WINDOW_MS);
        setStep("pix");
      } catch {
        setError("Erro de rede ao gerar o PIX.");
        setStep("shop");
      }
    })();
  }, [selectedOption.qty]);

  const goBack = useCallback(() => {
    setStep("shop");
    setPixPayload("");
    setTransactionId(null);
    setPixDeadline(null);
    setConfirmedPaid(false);
    paidHandledRef.current = false;
    setError(null);
  }, []);

  const handleVerifyPaid = useCallback(async () => {
    if (!transactionId || checkingManually) return;
    setCheckingManually(true);
    try {
      const r = await fetch(`/api/deposits/transactions/${transactionId}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await r.json()) as { transaction?: DepositTransaction };
      if (r.ok && data.transaction) {
        handleTransactionUpdate({
          status: data.transaction.status,
          pixQrcode: data.transaction.pixQrcode,
        });
        if (!isPaidStatus(data.transaction.status)) {
          setError(
            "Pagamento ainda não confirmado. Aguarde ou tente novamente.",
          );
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

  if (step === "generating") {
    return (
      <div className="min-h-screen w-full bg-black">
        <TicketPixGeneratingPanel />
      </div>
    );
  }

  if (step === "pix" && pixPayload) {
    return (
      <div className="min-h-screen w-full bg-black">
        <TicketPixGeneratedScreen
          pixPayload={pixPayload}
          secondsLeft={secondsLeft}
          pixExpired={pixExpired}
          pixProgressPct={pixProgressPct}
          onCopy={() => void navigator.clipboard.writeText(pixPayload)}
          onBack={goBack}
          onVerifyPaid={() => void handleVerifyPaid()}
          checkingManually={checkingManually}
          confirmedPaid={confirmedPaid}
          error={error}
          principalQty={selectedOption.qty}
          dailyQty={0}
          extraPixLines={[]}
          prices={{
            general: Math.round(selectedOption.priceCents / selectedOption.qty),
            daily: 0,
          }}
          principalUnitPriceCents={Math.round(
            selectedOption.priceCents / selectedOption.qty,
          )}
          dailyUnitPriceCents={0}
          totalCents={selectedOption.priceCents}
        />
      </div>
    );
  }

  return (
    <ShopScreen
      selected={selected}
      onSelect={setSelected}
      onContinue={goGenerate}
      error={error}
    />
  );
}
