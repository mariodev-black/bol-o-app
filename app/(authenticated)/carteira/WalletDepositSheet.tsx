"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import QRCode from "react-qr-code";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { formatBRLFromCents } from "@/lib/wallet/format";

type Deposit = {
  id: string;
  status: string;
  amountCents: number;
  pixQrcode: string | null;
};

const QUICK_AMOUNTS = [2000, 5000, 10000, 20000];
const MIN_CENTS = 1000;

type Step = "amount" | "pix" | "paid";

export function WalletDepositSheet({
  open,
  onClose,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const toast = useBolaoToast();
  const [step, setStep] = useState<Step>("amount");
  const [amountCents, setAmountCents] = useState<number>(5000);
  const [customReais, setCustomReais] = useState<string>("");
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    setStep("amount");
    setDeposit(null);
    setError(null);
    setCreating(false);
    esRef.current?.close();
    esRef.current = null;
  }, []);

  // Fecha SSE ao desmontar/fechar.
  useEffect(() => {
    if (!open) reset();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [open, reset]);

  // Assina o status do PIX (event-driven, sem polling).
  useEffect(() => {
    if (step !== "pix" || !deposit) return;
    const es = new EventSource(`/api/deposits/transactions/${deposit.id}/events`);
    esRef.current = es;
    es.addEventListener("transaction", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { status?: string };
        if (data.status === "paid" || data.status === "approved") {
          es.close();
          setStep("paid");
          onPaid();
        }
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, [step, deposit, onPaid]);

  if (!open) return null;

  const effectiveCustom = (() => {
    const n = Number(customReais.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  })();
  const selected = effectiveCustom > 0 ? effectiveCustom : amountCents;
  const valid = selected >= MIN_CENTS;

  async function handleGenerate() {
    if (!valid || creating) return;
    setCreating(true);
    setError(null);
    try {
      const r = await fetch("/api/wallet/deposits", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: selected }),
      });
      const data = (await r.json()) as { deposit?: Deposit; error?: string };
      if (!r.ok || !data.deposit) {
        setError(data.error ?? "Não foi possível gerar o PIX");
        return;
      }
      setDeposit(data.deposit);
      setStep("pix");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  function handleCopy() {
    const code = deposit?.pixQrcode?.trim();
    if (!code) return;
    void navigator.clipboard.writeText(code);
    toast.success("Código PIX copiado!");
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-[440px] overflow-hidden rounded-t-3xl border border-white/10 sm:rounded-3xl"
        style={{ background: "#0c0c0c" }}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <p className="text-[15px] font-black text-white">
            {step === "paid" ? "Saldo adicionado" : "Adicionar saldo"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 py-5">
          {step === "amount" ? (
            <>
              <p className="mb-4 text-[13px] text-white/45">
                Escolha quanto quer adicionar. Você paga via PIX e o saldo cai na carteira.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {QUICK_AMOUNTS.map((c) => {
                  const active = effectiveCustom === 0 && amountCents === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setAmountCents(c);
                        setCustomReais("");
                      }}
                      className={`flex h-14 items-center justify-center rounded-xl border text-[16px] font-black tabular-nums transition ${
                        active
                          ? "border-[#B1EB0B] bg-[#B1EB0B]/10 text-[#B1EB0B]"
                          : "border-white/10 bg-white/[0.04] text-white hover:border-white/25"
                      }`}
                    >
                      {formatBRLFromCents(c)}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-[12px] font-semibold text-white/50">
                  Ou outro valor
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5">
                  <span className="text-[15px] font-bold text-white/40">R$</span>
                  <input
                    inputMode="decimal"
                    value={customReais}
                    onChange={(e) => setCustomReais(e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder="0,00"
                    className="h-12 w-full bg-transparent text-[16px] font-bold text-white outline-none placeholder:text-white/25"
                  />
                </div>
              </div>

              {error ? <p className="mt-3 text-[13px] font-semibold text-red-300">{error}</p> : null}

              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!valid || creating}
                className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#B1EB0B] py-3.5 text-[15px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98] disabled:opacity-40"
              >
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Gerando PIX…
                  </>
                ) : (
                  <>Gerar PIX de {formatBRLFromCents(selected)}</>
                )}
              </button>
              {!valid ? (
                <p className="mt-2 text-center text-[12px] text-white/40">
                  Valor mínimo: {formatBRLFromCents(MIN_CENTS)}
                </p>
              ) : null}
            </>
          ) : step === "pix" && deposit ? (
            <>
              <p className="mb-1 text-center text-[12px] font-black uppercase tracking-[0.18em] text-[#B1EB0B]">
                Pague {formatBRLFromCents(deposit.amountCents)}
              </p>
              <p className="mb-4 text-center text-[12px] text-white/45">
                Escaneie o QR Code ou copie o código. O saldo cai automaticamente.
              </p>

              <div className="mx-auto w-fit rounded-2xl bg-white p-3">
                {deposit.pixQrcode ? (
                  <QRCode value={deposit.pixQrcode} size={196} level="M" />
                ) : (
                  <div className="flex size-[196px] items-center justify-center text-black/40">
                    <Loader2 className="size-6 animate-spin" />
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-stretch gap-2 rounded-xl border border-white/10 bg-black/50 p-1 pl-3">
                <p className="min-w-0 flex-1 truncate py-2.5 font-mono text-[11px] text-white/70">
                  {deposit.pixQrcode ?? "—"}
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex shrink-0 items-center justify-center rounded-lg px-3 text-[#B1EB0B] transition hover:opacity-90"
                  aria-label="Copiar código PIX"
                >
                  <Copy className="size-5" strokeWidth={2.2} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#B1EB0B]/50 bg-[#B1EB0B]/10 py-3.5 text-[12px] font-black uppercase tracking-wide text-[#B1EB0B] transition hover:bg-[#B1EB0B]/15 active:scale-[0.99]"
              >
                Copiar código PIX
                <Copy className="size-4" strokeWidth={2.2} />
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-white/40">
                <Loader2 className="size-3.5 animate-spin" />
                Aguardando pagamento…
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-full border border-[#0AC96B]/40 bg-[#0AC96B]/15">
                <Check className="size-8 text-[#0AC96B]" strokeWidth={2.5} />
              </span>
              <p className="text-[18px] font-black text-white">Pagamento confirmado!</p>
              <p className="text-[13px] text-white/50">
                {deposit ? formatBRLFromCents(deposit.amountCents) : ""} adicionados à sua carteira.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[#B1EB0B] text-[15px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
              >
                Concluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
