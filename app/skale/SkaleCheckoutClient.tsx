"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import logoSkale from "@/app/assets/skale.png";
import { TicketPixGeneratedScreen } from "@/app/(authenticated)/tickets/_components/pix/TicketPixGeneratedScreen";
import { TicketPixGeneratingPanel } from "@/app/(authenticated)/tickets/_components/pix/TicketPixGeneratingPanel";
import {
  PIX_CHECKOUT_TOTAL_SEC,
  PIX_CHECKOUT_WINDOW_MS,
} from "@/app/(authenticated)/tickets/_components/pix/ticket-pix-ui-constants";
import { appendTicketsFromPurchase } from "@/app/(authenticated)/tickets/lib/ownedTicketsStorage";
import { SKALE_PRIZE_RULES_COPY } from "@/lib/boloes/skale-prize";

const QTY_OPTIONS = [1, 2, 3, 5] as const;

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

export function SkaleCheckoutClient({
  championshipId,
  unitCents,
  displayName,
}: {
  championshipId: number;
  unitCents: number;
  displayName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<FlowStep>("shop");
  const [selectedQty, setSelectedQty] = useState<(typeof QTY_OPTIONS)[number]>(1);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState("");
  const [pixDeadline, setPixDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [checkingManually, setCheckingManually] = useState(false);
  const [confirmedPaid, setConfirmedPaid] = useState(false);
  const paidHandledRef = useRef(false);
  const purchaseQtyRef = useRef(1);

  const totalCents = unitCents * selectedQty;

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

  const extraPixLines = useMemo(
    () =>
      selectedQty > 0
        ? [
            {
              championshipId,
              qty: selectedQty,
              lineCents: totalCents,
              displayLabel: displayName,
            },
          ]
        : [],
    [championshipId, selectedQty, totalCents, displayName],
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
            ticketType: "extra",
            quantity: selectedQty,
            extraChampionshipId: championshipId,
          }),
        });
        const d = (await r.json()) as {
          error?: string;
          transaction?: DepositTransaction;
        };
        if (!r.ok || !d.transaction?.pixQrcode) {
          const raw = d.error ?? "Não foi possível gerar o PIX.";
          const friendly =
            /600[,.]00|maximo permitido|valor maximo/i.test(raw)
              ? "O gateway PIX aceita no máximo R$ 600 por transação. Compre menos cotas de uma vez ou entre em contato com o suporte."
              : raw;
          setError(friendly);
          setStep("shop");
          return;
        }
        purchaseQtyRef.current = selectedQty;
        setTransactionId(d.transaction.id);
        setPixPayload(d.transaction.pixQrcode);
        setPixDeadline(Date.now() + PIX_CHECKOUT_WINDOW_MS);
        setStep("pix");
      } catch {
        setError("Erro de rede ao gerar o PIX.");
        setStep("shop");
      }
    })();
  }, [championshipId, selectedQty]);

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
        appendTicketsFromPurchase(0, 0, {
          [championshipId]: purchaseQtyRef.current,
        });
        const q = new URLSearchParams({
          tx: transactionId,
          principal: "0",
          diario: "0",
          extra: String(purchaseQtyRef.current),
          skale: "1",
        });
        window.setTimeout(() => {
          router.replace(`/tickets/obrigado?${q.toString()}`);
        }, 1500);
      }
    },
    [router, transactionId, championshipId],
  );

  useEffect(() => {
    if (step !== "pix" || !transactionId) return;
    const es = new EventSource(`/api/deposits/transactions/${transactionId}/events`);
    es.addEventListener("transaction", (evt) => {
      try {
        const payload = JSON.parse((evt as MessageEvent).data) as TransactionUpdatePayload;
        handleTransactionUpdate(payload);
      } catch {
        // ignore
      }
    });
    return () => es.close();
  }, [step, transactionId, handleTransactionUpdate]);

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
        handleTransactionUpdate({
          status: data.transaction.status,
          pixQrcode: data.transaction.pixQrcode,
          providerTransactionId: data.transaction.providerTransactionId,
        });
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

  const verifyPaidManually = useCallback(() => {
    if (!transactionId) return;
    setCheckingManually(true);
    void fetch(`/api/deposits/transactions/${transactionId}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: { transaction?: DepositTransaction }) => {
        if (data.transaction) {
          handleTransactionUpdate({
            status: data.transaction.status,
            pixQrcode: data.transaction.pixQrcode,
          });
        }
      })
      .finally(() => setCheckingManually(false));
  }, [transactionId, handleTransactionUpdate]);

  if (step === "generating") {
    return <TicketPixGeneratingPanel />;
  }

  if (step === "pix" && pixPayload) {
    return (
      <TicketPixGeneratedScreen
        pixPayload={pixPayload}
        secondsLeft={secondsLeft}
        pixExpired={pixExpired}
        pixProgressPct={pixProgressPct}
        onCopy={() => void navigator.clipboard.writeText(pixPayload)}
        onBack={goBackFromPix}
        onVerifyPaid={verifyPaidManually}
        checkingManually={checkingManually}
        confirmedPaid={confirmedPaid}
        error={error}
        principalQty={0}
        dailyQty={0}
        extraPixLines={extraPixLines}
        prices={{ general: 0, daily: 0 }}
        principalUnitPriceCents={0}
        dailyUnitPriceCents={0}
        totalCents={totalCents}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-md flex-col px-5 pb-12 pt-8">
        <Link
          href="/boloes"
          className="mb-8 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-primary"
        >
          Voltar
        </Link>

        <div className="flex flex-col items-center text-center">
          <div className="mb-5 size-20 overflow-hidden rounded-2xl">
            <Image
              src={logoSkale}
              alt="Skale"
              width={80}
              height={80}
              className="size-full object-contain"
              priority
            />
          </div>

          <h1 className="text-[24px] font-black leading-tight">{displayName}</h1>
          <p className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-white/55">
            Palpites em todos os jogos da Copa 2026. Após o pagamento, sua cota aparece em Meus
            Bolões.
          </p>
          <p className="mt-3 max-w-[300px] text-[12px] leading-relaxed text-primary/90">
            {SKALE_PRIZE_RULES_COPY}
          </p>
        </div>

        <div className="mt-10">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
            Cotas
          </p>
          <div className="grid grid-cols-4 gap-2">
            {QTY_OPTIONS.map((qty) => {
              const active = selectedQty === qty;
              return (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setSelectedQty(qty)}
                  className={`rounded-xl py-3 text-center transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1]"
                  }`}
                >
                  <span className="block text-[17px] font-black">{qty}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[12px] text-white/45">{formatBRL(unitCents)} por cota</p>
          <p className="mt-1 text-[32px] font-black text-primary">{formatBRL(totalCents)}</p>
        </div>

        {error ? (
          <p className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-center text-[13px] text-red-300">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void goGenerate()}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-[15px] font-black uppercase tracking-[0.06em] text-primary-foreground transition-opacity hover:opacity-90"
        >
          Comprar cota
          <ArrowRight className="size-5" strokeWidth={2.5} />
        </button>

        <p className="mt-5 text-center text-[11px] text-white/35">Pagamento via PIX</p>
      </div>
    </div>
  );
}
