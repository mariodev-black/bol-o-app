"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Wallet,
  X,
  AlertCircle,
} from "lucide-react";
import type { BolaoDefinitionCatalogItem } from "@/lib/boloes/definitions/types";
import { formatBRLFromCents } from "@/lib/wallet/format";
import { useAuth } from "@/app/shared/AuthContext";
import { extraBolaoIconSrc, type ExtraBolaoIconVariant } from "@/app/shared/extra-bolao-icons";
import { QuantitySelector } from "./QuantitySelector";

const MAX_QUANTITY = 20;

export type CheckoutConfig = {
  prices?: {
    general?: number;
    daily?: number;
    skaleDaily?: number;
    extra?: number;
    artilheiros?: number;
  };
  walletCheckoutEnabled?: boolean;
  dailyEdition?: { number: number; label?: string | null; datesLabel?: string | null } | null;
  skaleDailyEdition?: { number: number; label?: string | null; datesLabel?: string | null } | null;
};

type PurchaseResponse = {
  error?: string;
  code?: string;
  purchase?: {
    transactionId: string;
    amountCents: number;
    ticketIds: string[];
    balanceCents: number;
  };
};

let checkoutConfigCache: CheckoutConfig | null = null;
let checkoutConfigPromise: Promise<CheckoutConfig> | null = null;

async function loadCheckoutConfig(): Promise<CheckoutConfig> {
  if (checkoutConfigCache) return checkoutConfigCache;
  checkoutConfigPromise ??= fetch("/api/deposits/transactions", {
    credentials: "include",
    cache: "no-store",
  })
    .then((resp) => resp.json())
    .then((json) => json as CheckoutConfig)
    .catch(() => ({}));
  checkoutConfigCache = await checkoutConfigPromise;
  return checkoutConfigCache;
}

function kindForItem(item: BolaoDefinitionCatalogItem):
  | "general"
  | "daily"
  | "skaleDaily"
  | "extra"
  | "artilheiros"
  | "definition" {
  if (item.id === "legacy-principal") return "general";
  if (item.id === "legacy-daily") return "daily";
  if (item.id === "legacy-skale-daily") return "skaleDaily";
  if (item.id === "legacy-artilheiros" || item.resolvedIconVariant === "artilheiros") {
    return "artilheiros";
  }
  if (item.id.startsWith("legacy-extra-") || item.id.startsWith("mock-")) return "extra";
  return "definition";
}

function parsePriceLabelCents(label: string | null | undefined): number {
  const normalized = String(label ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}

function displayPriceCents(item: BolaoDefinitionCatalogItem, config: CheckoutConfig | null): number {
  const prices = config?.prices ?? {};
  const kind = kindForItem(item);
  const embeddedPrice = Number(item.unitPriceCents) || parsePriceLabelCents(item.priceLabel);
  if (embeddedPrice > 0) return embeddedPrice;
  if (kind === "definition") return prices.extra || 0;
  if (kind === "general") return prices.general ?? 0;
  if (kind === "daily") return prices.daily ?? 0;
  if (kind === "skaleDaily") return prices.skaleDaily ?? prices.extra ?? 0;
  if (kind === "artilheiros") return prices.artilheiros ?? 0;
  return prices.extra ?? 0;
}

function resolveMaxQuantity(item: BolaoDefinitionCatalogItem): number {
  if (typeof item.maxTicketsPerUser === "number" && item.maxTicketsPerUser > 0) {
    return Math.min(item.maxTicketsPerUser, MAX_QUANTITY);
  }
  return MAX_QUANTITY;
}

function purchaseBodyForItem(
  item: BolaoDefinitionCatalogItem,
  config: CheckoutConfig | null,
  quantity: number,
): Record<string, unknown> {
  const kind = kindForItem(item);
  const qty = Math.max(1, Math.min(MAX_QUANTITY, Math.trunc(quantity) || 1));
  if (kind === "general") {
    return { ticketType: "general", quantity: qty, payWith: "wallet" };
  }
  if (kind === "extra") {
    return {
      ticketType: "extra",
      quantity: qty,
      extraChampionshipId: item.competitionId,
      payWith: "wallet",
    };
  }
  if (kind === "artilheiros") {
    return { ticketType: "artilheiros", quantity: qty, payWith: "wallet" };
  }
  if (kind === "daily") {
    const edition = config?.dailyEdition?.number;
    return {
      generalQuantity: 0,
      dailyQuantity: 0,
      dailyByEdition: edition ? { [String(edition)]: qty } : {},
      skaleDailyByEdition: {},
      extraByChampionship: {},
      artilheirosQuantity: 0,
      payWith: "wallet",
    };
  }
  if (kind === "skaleDaily") {
    const edition = config?.skaleDailyEdition?.number;
    return {
      generalQuantity: 0,
      dailyQuantity: 0,
      dailyByEdition: {},
      skaleDailyByEdition: edition ? { [String(edition)]: qty } : {},
      extraByChampionship: {},
      artilheirosQuantity: 0,
      payWith: "wallet",
    };
  }
  return {
    generalQuantity: 0,
    dailyQuantity: 0,
    dailyByEdition: {},
    skaleDailyByEdition: {},
    extraByChampionship: {},
    artilheirosQuantity: 0,
    definitionsById: { [item.id]: qty },
    payWith: "wallet",
  };
}

function successQueryForItem(item: BolaoDefinitionCatalogItem, tx: string): string {
  const kind = kindForItem(item);
  const q = new URLSearchParams({ tx });
  if (kind === "general") q.set("principal", "1");
  else if (kind === "daily" || kind === "skaleDaily") q.set("diario", "1");
  else q.set("extra", "1");
  return q.toString();
}

export function BolaoPurchaseModal({
  item,
  open,
  onClose,
}: {
  item: BolaoDefinitionCatalogItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { refresh, user } = useAuth();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [renderedItem, setRenderedItem] = useState<BolaoDefinitionCatalogItem | null>(item);
  const [closing, setClosing] = useState(false);
  const [config, setConfig] = useState<CheckoutConfig | null>(checkoutConfigCache);
  const [balanceCents, setBalanceCents] = useState<number | null>(
    typeof user?.balanceCents === "number" ? user.balanceCents : null,
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const activeItem = item ?? renderedItem;
  const logoSrc = activeItem
    ? activeItem.resolvedLogoUrl ??
      extraBolaoIconSrc((activeItem.resolvedIconVariant || "generic") as ExtraBolaoIconVariant).src
    : "";
  const priceCents = activeItem ? displayPriceCents(activeItem, config) : 0;
  const maxQuantity = activeItem ? resolveMaxQuantity(activeItem) : MAX_QUANTITY;
  const totalCents = useMemo(() => priceCents * quantity, [priceCents, quantity]);
  const balance = balanceCents ?? 0;
  const missingCents = Math.max(0, totalCents - balance);
  const hasBalance = balanceCents != null && totalCents > 0 && balance >= totalCents;
  const walletEnabled = config?.walletCheckoutEnabled ?? false;
  const ready = !loading && balanceCents != null && config != null;
  const canPurchase = ready && walletEnabled && hasBalance;
  const phase = activeItem?.subtitle?.trim() || activeItem?.datesLabel || null;

  const requestClose = useCallback(() => {
    if (submitting) return;
    setClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setClosing(false);
      setRenderedItem(null);
      setQuantity(1);
      onClose();
    }, 180);
  }, [onClose, submitting]);

  useEffect(() => {
    if (open && item) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setRenderedItem(item);
      setQuantity(1);
      setClosing(false);
    }
  }, [item, open]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof user?.balanceCents === "number") {
        setBalanceCents(user.balanceCents);
      }
      const [shop, walletResp] = await Promise.all([
        loadCheckoutConfig(),
        fetch("/api/wallet/summary", { credentials: "include", cache: "no-store" }),
      ]);
      const wallet = (await walletResp.json().catch(() => ({}))) as { balanceCents?: number };
      setConfig(shop);
      setBalanceCents(typeof wallet.balanceCents === "number" ? wallet.balanceCents : 0);
    } catch {
      setConfig({});
      setBalanceCents(0);
      setError("Não foi possível carregar seu saldo agora.");
    } finally {
      setLoading(false);
    }
  }, [user?.balanceCents]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadCheckoutConfig().then(setConfig);
    }, 350);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!open && typeof user?.balanceCents === "number") {
      setBalanceCents(user.balanceCents);
    }
  }, [open, user?.balanceCents]);

  useEffect(() => {
    if (!open) {
      setConfig(checkoutConfigCache);
      if (typeof user?.balanceCents === "number") setBalanceCents(user.balanceCents);
      setError(null);
      setSubmitting(false);
      setQuantity(1);
      return;
    }
    void load();
  }, [open, load, user?.balanceCents]);

  const handleQuantityChange = useCallback((next: number) => {
    setQuantity(next);
    setError(null);
  }, []);

  const handleBuy = useCallback(async () => {
    if (!activeItem || submitting || !canPurchase) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/deposits/transactions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchaseBodyForItem(activeItem, config, quantity)),
      });
      const data = (await resp.json().catch(() => ({}))) as PurchaseResponse;
      if (resp.status === 402 || data.code === "WALLET_INSUFFICIENT_FUNDS") {
        setBalanceCents(typeof data.purchase?.balanceCents === "number" ? data.purchase.balanceCents : balance);
        setError(data.error ?? "Saldo insuficiente para concluir a compra.");
        return;
      }
      if (!resp.ok || !data.purchase) {
        setError(data.error ?? "Não foi possível concluir a compra.");
        return;
      }
      await refresh().catch(() => {});
      onClose();
      router.replace(`/tickets/obrigado?${successQueryForItem(activeItem, data.purchase.transactionId)}`);
    } catch {
      setError("Erro de rede ao concluir a compra.");
    } finally {
      setSubmitting(false);
    }
  }, [activeItem, balance, canPurchase, config, onClose, quantity, refresh, router, submitting]);

  const modal = useMemo(() => {
    if ((!open && !closing) || !activeItem) return null;
    return (
      <div className="fixed inset-0 z-[320] flex items-center justify-center px-4">
        <button
          type="button"
          className={`absolute inset-0 bg-black/70 backdrop-blur-[2px] duration-200 ${
            closing ? "animate-out fade-out" : "animate-in fade-in"
          }`}
          onClick={requestClose}
          aria-label="Fechar modal de compra"
        />
        <section
          className={`relative w-full max-w-[420px] overflow-hidden rounded-[26px] border border-white/10 bg-[#0A0A0A] text-white duration-200 ${
            closing
              ? "animate-out fade-out zoom-out-95"
              : "animate-in fade-in zoom-in-95"
          }`}
        >
          <div className="relative px-5 pb-5 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                Adquirir bolão
              </p>
              <button
                type="button"
                onClick={requestClose}
                className="flex size-9 items-center justify-center rounded-full text-white/45 transition hover:bg-white/5 hover:text-white"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center text-center">
              <div className="flex size-[74px] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt="" className="max-h-14 max-w-14 object-contain" draggable={false} />
              </div>
              <div className="mt-4 min-w-0">
                <h2 className="text-[24px] font-black uppercase leading-[1.02] tracking-[-0.05em]">
                  {activeItem.displayName}
                </h2>
                {phase ? (
                  <p className="mt-2 inline-flex rounded-full bg-white/7 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white/58">
                    {phase}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.025] p-3 transition-colors">
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-white/45">Valor da cota</p>
                <p className="mt-2 text-[22px] font-black text-primary transition-all duration-300">
                  {priceCents > 0 ? formatBRLFromCents(priceCents) : "…"}
                </p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/[0.025] p-3 transition-colors">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-white/45">
                  <Wallet className="size-3 text-primary" />
                  Seu saldo
                </p>
                <p className="mt-2 text-[22px] font-black text-white transition-all duration-300">
                  {balanceCents != null ? formatBRLFromCents(balance) : "…"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.025] p-3">
              <QuantitySelector
                label="Quantidade"
                value={quantity}
                min={1}
                max={maxQuantity}
                onChange={handleQuantityChange}
                disabled={!ready || submitting}
              />
            </div>

            <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-white/45">Total</p>
              <p className="mt-1 text-[26px] font-black text-primary transition-all duration-300">
                {totalCents > 0 ? formatBRLFromCents(totalCents) : "…"}
              </p>
            </div>

            <div
              className={`mt-4 rounded-[18px] border px-4 py-3 transition-all duration-300 ${
                hasBalance
                  ? "border-primary/20 bg-primary/[0.04]"
                  : "border-red-400/20 bg-red-500/10"
              }`}
            >
              <div className="flex items-start gap-2.5 text-left">
                {hasBalance ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                )}
                <p className="text-[12px] font-semibold leading-relaxed text-white/62">
                  {hasBalance ? (
                    <>
                      Sua compra será debitada automaticamente do saldo da carteira. Após a confirmação, suas cotas aparecerão imediatamente em <strong className="text-white">Meus bolões</strong>.
                    </>
                  ) : balanceCents != null ? (
                    <>
                      Saldo insuficiente. Faltam <strong className="text-red-200">{formatBRLFromCents(missingCents)}</strong> para concluir.
                    </>
                  ) : (
                    <>Carregando saldo…</>
                  )}
                </p>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-center text-[12px] font-bold text-red-200 animate-in fade-in slide-in-from-top-1">
                {error}
              </p>
            ) : null}

            {!walletEnabled ? (
              <button
                type="button"
                disabled
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[18px] bg-primary text-[14px] font-black uppercase tracking-wide text-[#0E141B] opacity-45 transition"
              >
                Pagamento com saldo indisponível
              </button>
            ) : hasBalance ? (
              <button
                type="button"
                onClick={handleBuy}
                disabled={!ready || submitting}
                className="group relative mt-5 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[18px] bg-primary text-[14px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98] disabled:opacity-45"
              >
                <span className="absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] bg-white/30 transition-transform duration-700 group-hover:translate-x-[340%]" />
                <span className="relative inline-flex items-center gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Comprando…
                    </>
                  ) : (
                    <>
                      Comprar agora
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={2.8} />
                    </>
                  )}
                </span>
              </button>
            ) : (
              <Link
                href="/carteira"
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[18px] bg-red-500 text-[14px] font-black uppercase tracking-wide text-white transition hover:bg-red-600 active:scale-[0.98]"
              >
                Adicionar saldo
                <ArrowRight className="size-4" strokeWidth={2.8} />
              </Link>
            )}

            <button
              type="button"
              onClick={requestClose}
              disabled={submitting}
              className="mt-2 flex h-10 w-full items-center justify-center rounded-xl text-[13px] font-bold text-white/45 transition hover:text-white disabled:opacity-40"
            >
              Agora não
            </button>
          </div>
        </section>
      </div>
    );
  }, [
    activeItem,
    balance,
    balanceCents,
    closing,
    error,
    handleBuy,
    handleQuantityChange,
    hasBalance,
    logoSrc,
    maxQuantity,
    missingCents,
    open,
    phase,
    priceCents,
    quantity,
    ready,
    requestClose,
    submitting,
    totalCents,
    walletEnabled,
  ]);


  return modal;
}
