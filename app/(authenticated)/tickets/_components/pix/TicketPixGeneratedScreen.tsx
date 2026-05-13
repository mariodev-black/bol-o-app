"use client";

import { useCallback } from "react";
import {
  Check,
  Copy,
  Loader2,
  Lock,
  Shield,
  Trophy,
  Users,
} from "lucide-react";
import QRCode from "react-qr-code";
import { useBolaoToast } from "@/app/components/BolaoToast";
import { montserrat } from "./ticket-pix-ui-constants";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function truncatePixPayload(s: string, head = 36) {
  if (s.length <= head + 8) return s;
  return `${s.slice(0, head)}…`;
}

export type TicketPixGeneratedScreenProps = {
  pixPayload: string;
  secondsLeft: number;
  pixExpired: boolean;
  pixProgressPct: number;
  onCopy: () => void;
  onBack: () => void;
  onVerifyPaid: () => void;
  checkingManually: boolean;
  confirmedPaid: boolean;
  error: string | null;
  principalQty: number;
  dailyQty: number;
  prices: { general: number; daily: number };
  principalUnitPriceCents: number;
  dailyUnitPriceCents: number;
  totalCents: number;
};

export function TicketPixGeneratedScreen({
  pixPayload,
  secondsLeft,
  pixExpired,
  pixProgressPct,
  onCopy,
  onBack,
  onVerifyPaid,
  checkingManually,
  confirmedPaid,
  error,
  principalQty,
  dailyQty,
  prices,
  principalUnitPriceCents,
  dailyUnitPriceCents,
  totalCents,
}: TicketPixGeneratedScreenProps) {
  const toast = useBolaoToast();
  const totalQty = principalQty + dailyQty;

  const handleCopyPix = useCallback(() => {
    if (pixExpired || !pixPayload.trim()) return;
    onCopy();
    toast.success("Código PIX copiado!");
  }, [pixExpired, pixPayload, onCopy, toast]);

  const orderDescriptionParts: string[] = [];
  if (principalQty > 0)
    orderDescriptionParts.push(`Geral | ${formatBRL(prices.general)}`);
  if (dailyQty > 0)
    orderDescriptionParts.push(`Cota ${formatBRL(prices.daily)}`);
  orderDescriptionParts.push(`${totalQty} ticket${totalQty === 1 ? "" : "s"}`);
  const orderDescriptionLine = orderDescriptionParts.join(" • ");

  const quantitySegments: string[] = [];
  if (principalQty > 0) {
    quantitySegments.push(
      `${principalQty}x Geral @ ${formatBRL(principalUnitPriceCents)}`,
    );
  }
  if (dailyQty > 0) {
    quantitySegments.push(
      `${dailyQty}x Cota @ ${formatBRL(dailyUnitPriceCents)}`,
    );
  }
  const quantityRight = quantitySegments.join(" · ") || "—";

  return (
    <div className="relative mx-auto w-full max-w-[430px] px-4 pb-10 pt-6 sm:px-5 sm:pt-8">
      {confirmedPaid && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#0AC96B]/40 bg-[#050505]/95 px-6 py-10 text-center backdrop-blur-sm">
          <span className="flex size-14 items-center justify-center rounded-full border border-[#0AC96B]/40 bg-[#0AC96B]/20">
            <Check className="size-7 text-[#0AC96B]" strokeWidth={2.5} />
          </span>
          <p className="text-[18px] font-black text-white">
            Pagamento confirmado!
          </p>
          <p className="text-[13px] text-white/55">
            Redirecionando para seus tickets…
          </p>
          <Loader2 className="size-5 animate-spin text-[#0AC96B]/70" />
        </div>
      )}

      {/* Cabeçalho */}
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary"
              style={{ boxShadow: "0 0 20px rgba(177,235,11,0.45)" }}
            >
              <Check
                className="size-6 text-black"
                strokeWidth={3}
                aria-hidden
              />
            </div>
            <div className="min-w-0 pt-0.5">
              <h1
                className="text-[15px] font-black uppercase leading-tight tracking-wide text-white sm:text-[16px]"
                style={{ fontFamily: montserrat }}
              >
                PIX GERADO COM SUCESSO!
              </h1>
              <p
                className="mt-2 text-[13px] leading-snug text-white/70 sm:text-[13px]"
                style={{ fontFamily: montserrat }}
              >
                Pague em até{" "}
                <span className="font-black text-primary">15 minutos</span>.
              </p>
            </div>
          </div>
          <div
            className="shrink-0 rounded-xl border-2 border-primary px-3 py-2 font-mono text-[17px] font-black tabular-nums text-primary sm:text-[18px]"
            style={{ fontFamily: montserrat }}
          >
            {pixExpired ? "0:00" : formatCountdown(secondsLeft)}
          </div>
        </div>
        <div
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
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
                ? "rgba(248,113,113,0.55)"
                : secondsLeft <= 60
                  ? "linear-gradient(90deg, #FBBF24, #F59E0B)"
                  : "linear-gradient(90deg, #E8FF8A, #B1EB0B)",
            }}
          />
        </div>
      </header>

      {/* Card principal */}
      <section
        className="rounded-2xl border border-white/[0.08] p-5 sm:p-6"
        style={{
          background: "linear-gradient(180deg, #151515 0%, #101010 100%)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        <p
          className="mb-5 text-center text-[11px] font-black uppercase tracking-[0.2em] text-primary sm:text-[12px]"
          style={{ fontFamily: montserrat }}
        >
          Escaneie o QR Code e pague com PIX
        </p>

        <div className="relative mx-auto w-fit">
          <div className="pointer-events-none absolute -inset-3">
            <span className="absolute left-0 top-0 size-5 border-l-2 border-t-2 border-primary" />
            <span className="absolute right-0 top-0 size-5 border-r-2 border-t-2 border-primary" />
            <span className="absolute bottom-0 left-0 size-5 border-b-2 border-l-2 border-primary" />
            <span className="absolute bottom-0 right-0 size-5 border-b-2 border-r-2 border-primary" />
          </div>
          <div
            className={`relative rounded-2xl bg-white p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] sm:p-3.5 ${pixExpired ? "opacity-35 grayscale" : ""}`}
          >
            <QRCode value={pixPayload} size={200} level="M" />
            {pixExpired && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 px-3">
                <p className="text-center text-[13px] font-bold leading-snug text-white">
                  QR expirado — volte e gere outro PIX
                </p>
              </div>
            )}
          </div>
        </div>

        <p
          className="mb-2 mt-6 text-center text-[11px] font-semibold text-white/55"
          style={{ fontFamily: montserrat }}
        >
          Ou copie o código PIX
        </p>
        <div className="flex items-stretch gap-2 rounded-xl border border-white/10 bg-black/50 p-1 pl-3">
          <p className="min-w-0 flex-1 truncate py-2.5 font-mono text-[11px] leading-relaxed text-white/75 sm:text-[12px]">
            {truncatePixPayload(pixPayload)}
          </p>
          <button
            type="button"
            onClick={handleCopyPix}
            disabled={pixExpired}
            className="flex shrink-0 items-center justify-center rounded-lg px-3 text-primary transition-opacity hover:opacity-90 disabled:opacity-30"
            aria-label="Copiar código PIX"
          >
            <Copy className="size-5" strokeWidth={2.2} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopyPix}
          disabled={pixExpired}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/50 bg-primary/10 px-3 py-4 text-[11px] font-black uppercase leading-tight tracking-wide text-primary transition-[filter,transform] hover:bg-primary/15 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 sm:text-[12px]"
          style={{ fontFamily: montserrat }}
        >
          COPIAR CÓDIGO PIX
          <Copy className="size-5" strokeWidth={2.2} />
        </button>

        <div className="mt-7">
          <p
            className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-primary"
            style={{ fontFamily: montserrat }}
          >
            Detalhes do pedido
          </p>
          <p
            className="text-[12px] leading-relaxed text-white sm:text-[13px]"
            style={{ fontFamily: montserrat }}
          >
            {orderDescriptionLine}
          </p>
          <div
            className="mt-3 flex items-start justify-between gap-3 text-[12px] sm:text-[13px]"
            style={{ fontFamily: montserrat }}
          >
            <span className="font-semibold text-white/80">Quantidade</span>
            <span className="max-w-[62%] text-right font-bold text-primary">
              {quantityRight}
            </span>
          </div>
          <div
            className="mt-4 flex items-center justify-between border-t border-white/10 pt-4"
            style={{ fontFamily: montserrat }}
          >
            <span className="text-[14px] font-black text-white">Total</span>
            <span className="text-[18px] font-black tabular-nums text-primary sm:text-[20px]">
              {formatBRL(totalCents)}
            </span>
          </div>
        </div>
      </section>

      {/* Selos de confiança */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-2">
        <div className="rounded-xl border border-white/[0.07] bg-[#111] px-2 py-3 text-center">
          <Shield className="mx-auto size-5 text-primary" strokeWidth={2} />
          <p className="mt-2 text-[9px] font-black uppercase leading-tight tracking-wide text-white">
            100% SEGURO
          </p>
          <p className="mt-1 text-[8px] leading-snug text-white/40">
            Ambiente protegido
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#111] px-2 py-3 text-center">
          <Lock className="mx-auto size-5 text-primary" strokeWidth={2} />
          <p className="mt-2 text-[9px] font-black uppercase leading-tight tracking-wide text-white">
            PAGAMENTO SEGURO
          </p>
          <p className="mt-1 text-[8px] leading-snug text-white/40">
            Seus dados protegidos
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#111] px-2 py-3 text-center">
          <Users className="mx-auto size-5 text-primary" strokeWidth={2} />
          <p className="mt-2 text-[9px] font-black uppercase leading-tight tracking-wide text-white">
            + DE 2.500 PREMIADOS
          </p>
          <p className="mt-1 text-[8px] leading-snug text-white/40">
            Você pode ser um deles!
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#111] px-2 py-3 text-center">
          <Trophy className="mx-auto size-5 text-primary" strokeWidth={2} />
          <p className="mt-2 text-[9px] font-black uppercase leading-tight tracking-wide text-white">
            PREMIAÇÃO GARANTIDA
          </p>
          <p className="mt-1 text-[8px] leading-snug text-white/40">
            Paga aos vencedores
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-center text-[12px] font-semibold text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
