"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Lock,
  Percent,
  Shield,
  ShoppingCart,
  Tags,
  Ticket,
  Trophy,
  Wallet,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import bannerCheckout from "@/app/assets/banner-chekout.png";
import iconBrasileirao from "@/app/assets/icon-brasileirao.png";
import iconCopaBrasil from "@/app/assets/icon-copa-brasil.png";
import iconCopaMundo from "@/app/assets/icon-copa-mundo.png";
import iconeBolaoArtilheiro from "@/app/assets/icone-bolao-artilheiro.png";
import logoBolaoDiario from "@/app/assets/logo-bolao-diario.png";
import skaleLogo from "@/app/assets/skale.png";
import ticketBlue from "@/app/assets/Ticket-Blue.png";
import {
  getExtraBolaoHeroSideVariant,
  resolveExtraBolaoDisplayName,
} from "@/lib/boloes-extra-competition-branding";
import { getExtraBolaoFirstPlaceLine } from "@/lib/boloes-prize-copy";
import {
  extraBolaoIconSrc,
  isExtraBolaoBrandedIcon,
} from "@/app/shared/extra-bolao-icons";
import {
  getTicketShopExtraPresentation,
  applyTicketShopExtraCatalogItem,
} from "@/lib/ticket-shop-extra-display";
import {
  filterTicketShopExtraBoloes,
  filterTicketShopExtraChampionshipIds,
} from "@/lib/ticket-shop-flags";
import { appendTicketsFromPurchase } from "../lib/ownedTicketsStorage";
import { AppScreenLoading } from "@/app/shared/AppScreenLoading";
import { TicketPixGeneratedScreen } from "./pix/TicketPixGeneratedScreen";
import { TicketPixGeneratingPanel } from "./pix/TicketPixGeneratingPanel";
import {
  PIX_CHECKOUT_TOTAL_SEC,
  PIX_CHECKOUT_WINDOW_MS,
} from "./pix/ticket-pix-ui-constants";

const DEFAULT_PRINCIPAL_CENTS = 3990;
const DEFAULT_DIARIO_CENTS = 1000;
const DEFAULT_EXTRA_CENTS = 1000;
const DEFAULT_SKALE_DAILY_CENTS = 10_000;
const DEFAULT_ARTILHEIROS_CENTS = 2000;

/** Mesmo espírito de `BOLOES_EXTRA_*` — permite cards no primeiro paint antes do GET (opcional). */
function parseNextPublicExtraChampionshipIds(): number[] {
  const raw =
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_BOLOES_EXTRA_CHAMPIONSHIP_IDS
      : "") ||
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_BOLOES_EXTRA
      : "") ||
    "";
  if (!String(raw).trim()) return [];
  const parsed = String(raw)
    .split(/[,;\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return filterTicketShopExtraChampionshipIds(parsed);
}

type ExtraBolaoOption = {
  championshipId: number;
  unitCents: number;
  displayName?: string;
  /** Rodada atual do campeonato (número + rótulo, ex.: "17ª Rodada"). */
  roundNumber?: number;
  roundLabel?: string;
};

type DailyEditionCatalogItem = {
  number: number;
  label: string;
  datesLabel: string;
  status: "aberto" | "encerrado" | "em_breve";
  purchaseOpen: boolean;
};

type CatalogBolaoItem = {
  id: string;
  displayName: string;
  subtitle: string | null;
  unitPriceCents: number;
  priceLabel: string;
  datesLabel: string | null;
  resolvedLogoUrl: string | null;
  resolvedIconVariant: string;
  purchaseOpen: boolean;
};

function formatBRL(cents: number) {
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

function progressiveDiscountPercent(quantity: number): number {
  if (quantity >= 4) return 15;
  if (quantity === 3) return 10;
  if (quantity === 2) return 5;
  return 0;
}

function progressiveDiscountTotalCents(
  unitCents: number,
  quantity: number,
): number {
  if (quantity <= 0) return 0;
  const subtotal = unitCents * quantity;
  return Math.round(
    (subtotal * (100 - progressiveDiscountPercent(quantity))) / 100,
  );
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
  initialTicketKind?: "general" | "daily" | "extra" | "artilheiros";
  /** Com `initialTicketKind === "extra"`, pré-seleciona este campeonato (id da API). */
  initialExtraChampionshipId?: number;
  /** IDs extras vindos do servidor — alinhados a `BOLOES_EXTRA_*`. */
  serverExtraChampionshipIds?: number[];
  /**
   * Quando true (env `TICKETS_EXTRA_ONLY`): oculta bolão geral e bolão do dia na loja;
   * só exibe a compra de bolões extra.
   */
  ticketsExtraOnly?: boolean;
  /** Quando true (env `TICKETS_HIDE_DAILY`): oculta só o bolão do dia; geral e extra permanecem. */
  ticketsHideDaily?: boolean;
  /** Loja `/tickets`: exibe somente Bolão do Milhão (principal). */
  ticketsPrincipalOnly?: boolean;
  /** Loja `/tickets`: somente principal + edições do bolão diário (sem extras). */
  ticketsPrincipalAndDailyOnly?: boolean;
  /** Loja `/tickets`: exibe principal + diário + artilheiros, sem extras. */
  ticketsHideExtra?: boolean;
  /** Loja `/tickets?bolao=artilheiros`: somente artilheiros. */
  ticketsArtilheirosOnly?: boolean;
  /** Pré-seleciona bolão diário Skale (`?bolao=skale-diario`). */
  initialSkaleDaily?: boolean;
};

const MAX_QTY = 20;

const TICKET_CARD_LOGO_WRAP_CLASS =
  "flex h-[104px] w-[86px] shrink-0 items-center justify-center sm:h-[112px] sm:w-[92px]";
const TICKET_CARD_LOGO_CLASS =
  "max-h-full max-w-full object-contain";

export function TicketCheckoutFlow({
  initialTicketKind = "general",
  initialExtraChampionshipId: _initialExtraChampionshipId,
  serverExtraChampionshipIds = [],
  ticketsExtraOnly = false,
  ticketsHideDaily = false,
  ticketsPrincipalOnly = false,
  ticketsPrincipalAndDailyOnly = false,
  ticketsHideExtra = false,
  ticketsArtilheirosOnly = false,
  initialSkaleDaily = false,
}: TicketCheckoutFlowProps) {
  const router = useRouter();
  const showPrincipal = !ticketsExtraOnly && !ticketsArtilheirosOnly;
  const showDaily =
    !ticketsHideDaily &&
    !ticketsArtilheirosOnly &&
    (ticketsPrincipalAndDailyOnly || !ticketsPrincipalOnly);
  const showExtra =
    !ticketsPrincipalOnly &&
    !ticketsPrincipalAndDailyOnly &&
    !ticketsHideExtra &&
    !ticketsExtraOnly &&
    !ticketsArtilheirosOnly;
  const [artilheirosEnabled, setArtilheirosEnabled] = useState(true);
  const showArtilheiros =
    ticketsArtilheirosOnly ||
    (artilheirosEnabled &&
      !ticketsPrincipalAndDailyOnly &&
      !ticketsExtraOnly &&
      !ticketsPrincipalOnly);
  const [principalQty, setPrincipalQty] = useState(() => {
    if (ticketsExtraOnly) return 0;
    if (ticketsPrincipalOnly) return 1;
    return initialTicketKind === "daily" ||
      initialTicketKind === "extra" ||
      initialTicketKind === "artilheiros"
      ? 0
      : 1;
  });
  const [artilheirosQty, setArtilheirosQty] = useState(() => {
    if (ticketsArtilheirosOnly || initialTicketKind === "artilheiros") return 1;
    return 0;
  });
  const [dailyQtyByEdition, setDailyQtyByEdition] = useState<Record<number, number>>(
    () => ({}),
  );
  const [currentDailyEdition, setCurrentDailyEdition] =
    useState<DailyEditionCatalogItem | null>(null);
  const [extraBoloes, setExtraBoloes] = useState<ExtraBolaoOption[]>(() => {
    if (ticketsPrincipalOnly || ticketsPrincipalAndDailyOnly) return [];
    const fromServer = filterTicketShopExtraChampionshipIds(
      (serverExtraChampionshipIds ?? []).filter(
        (n) => Number.isFinite(n) && n > 0,
      ),
    );
    const fromPublic = parseNextPublicExtraChampionshipIds();
    const ids = filterTicketShopExtraChampionshipIds([
      ...new Set([...fromServer, ...fromPublic]),
    ]);
    return ids.map((championshipId) =>
      applyTicketShopExtraCatalogItem({
        championshipId,
        unitCents: DEFAULT_EXTRA_CENTS,
      }),
    );
  });
  const [extraQtyByChampionship, setExtraQtyByChampionship] = useState<
    Record<number, number>
  >(() => {
    if (ticketsPrincipalOnly || ticketsPrincipalAndDailyOnly) return {};
    if (
      _initialExtraChampionshipId != null &&
      (ticketsExtraOnly || initialTicketKind === "extra")
    ) {
      return { [_initialExtraChampionshipId]: 1 };
    }
    return {};
  });
  const [currentSkaleDailyEdition, setCurrentSkaleDailyEdition] =
    useState<DailyEditionCatalogItem | null>(null);
  const [skaleDailyQtyByEdition, setSkaleDailyQtyByEdition] = useState<
    Record<number, number>
  >(() => ({}));
  const [catalogBoloes, setCatalogBoloes] = useState<CatalogBolaoItem[]>([]);
  const [catalogQtyById, setCatalogQtyById] = useState<Record<string, number>>(
    () => ({}),
  );
  const [prices, setPrices] = useState({
    general: DEFAULT_PRINCIPAL_CENTS,
    daily: DEFAULT_DIARIO_CENTS,
    skaleDaily: DEFAULT_SKALE_DAILY_CENTS,
    extra: DEFAULT_EXTRA_CENTS,
    artilheiros: DEFAULT_ARTILHEIROS_CENTS,
  });
  const [step, setStep] = useState<FlowStep>("shop");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState("");
  const [pixDeadline, setPixDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponHint, setCouponHint] = useState<string | null>(null);
  const [checkingManually, setCheckingManually] = useState(false);
  const [confirmedPaid, setConfirmedPaid] = useState(false);
  /** Catálogo (preços + nomes dos bolões extra) vindo do servidor — evita troca de layout no 1º paint. */
  const [catalogReady, setCatalogReady] = useState(false);
  const paidHandledRef = useRef(false);
  const purchasePrincipalRef = useRef(0);
  const purchaseDiarioRef = useRef(0);
  const purchaseExtraRef = useRef<Record<number, number>>({});

  useEffect(() => {
    if (!ticketsExtraOnly) return;
    setPrincipalQty(0);
    setDailyQtyByEdition({});
  }, [ticketsExtraOnly]);

  useEffect(() => {
    if (showDaily) return;
    setDailyQtyByEdition({});
  }, [showDaily]);

  useEffect(() => {
    if (!ticketsPrincipalOnly) return;
    setPrincipalQty((q) => (q > 0 ? q : 1));
    setDailyQtyByEdition({});
    setExtraQtyByChampionship({});
    setExtraBoloes([]);
  }, [ticketsPrincipalOnly]);

  useEffect(() => {
    if (!ticketsPrincipalAndDailyOnly) return;
    setExtraQtyByChampionship({});
    setExtraBoloes([]);
  }, [ticketsPrincipalAndDailyOnly]);

  const setSkaleDailyEditionQty = useCallback((edition: number, qty: number) => {
    setSkaleDailyQtyByEdition((prev) => ({
      ...prev,
      [edition]: Math.max(0, Math.min(MAX_QTY, qty)),
    }));
  }, []);

  const skaleDailyEditionQty = useCallback(
    (edition: number) => skaleDailyQtyByEdition[edition] ?? 0,
    [skaleDailyQtyByEdition],
  );
  const catalogQty = useCallback(
    (id: string) => catalogQtyById[id] ?? 0,
    [catalogQtyById],
  );
  const setCatalogQty = useCallback((id: string, qty: number) => {
    setCatalogQtyById((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(MAX_QTY, Math.trunc(qty))),
    }));
  }, []);

  const setDailyEditionQty = useCallback((edition: number, qty: number) => {
    setDailyQtyByEdition((prev) => ({
      ...prev,
      [edition]: Math.max(0, Math.min(MAX_QTY, qty)),
    }));
  }, []);

  const dailyEditionQty = useCallback(
    (edition: number) => dailyQtyByEdition[edition] ?? 0,
    [dailyQtyByEdition],
  );

  useEffect(() => {
    setExtraQtyByChampionship((prev) => {
      const next = { ...prev };
      for (const b of extraBoloes) {
        if (next[b.championshipId] == null) next[b.championshipId] = 0;
      }
      return next;
    });
  }, [extraBoloes]);

  const handleTransactionUpdate = useCallback(
    (payload: TransactionUpdatePayload, source?: string) => {
      if (payload.status) {
        console.log("[PIX] status update", {
          source,
          status: payload.status,
          transactionId,
        });
      }
      if (payload.pixQrcode) setPixPayload(payload.pixQrcode);

      if (
        transactionId &&
        payload.status &&
        isPaidStatus(payload.status) &&
        !paidHandledRef.current
      ) {
        console.log("[PIX] PAGAMENTO CONFIRMADO — redirecionando", {
          source,
          status: payload.status,
        });
        paidHandledRef.current = true;
        setConfirmedPaid(true);
        appendTicketsFromPurchase(
          purchasePrincipalRef.current,
          purchaseDiarioRef.current,
          purchaseExtraRef.current,
        );
        const q = new URLSearchParams({
          tx: transactionId,
          principal: String(purchasePrincipalRef.current),
          diario: String(purchaseDiarioRef.current),
        });
        const extraTotal = Object.values(purchaseExtraRef.current).reduce(
          (s, n) => s + n,
          0,
        );
        if (extraTotal > 0) q.set("extra", String(extraTotal));
        // Pequeno delay para o usuário ver o feedback "Pagamento confirmado!"
        window.setTimeout(() => {
          router.replace(`/tickets/obrigado?${q.toString()}`);
        }, 1500);
      }
    },
    [router, transactionId],
  );

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
          prices?: {
            general: number;
            daily: number;
            skaleDaily?: number;
            extra?: number;
            artilheiros?: number;
          };
          artilheirosEnabled?: boolean;
          dailyEdition?: DailyEditionCatalogItem | null;
          skaleDailyEdition?: DailyEditionCatalogItem | null;
          extraBoloes?: Array<{
            championshipId: number;
            unitCents: number;
            displayName?: string;
            roundNumber?: number;
            roundLabel?: string;
          }>;
          catalogBoloes?: CatalogBolaoItem[];
        };
        if (cancelled) return;
        if (r.ok && d.prices) {
          setPrices({
            general: d.prices.general,
            daily: d.prices.daily,
            skaleDaily: d.prices.skaleDaily ?? DEFAULT_SKALE_DAILY_CENTS,
            extra: d.prices.extra ?? DEFAULT_EXTRA_CENTS,
            artilheiros: d.prices.artilheiros ?? DEFAULT_ARTILHEIROS_CENTS,
          });
        }
        if (r.ok && typeof d.artilheirosEnabled === "boolean") {
          setArtilheirosEnabled(d.artilheirosEnabled);
        }
        if (r.ok && d.dailyEdition) {
          setCurrentDailyEdition(d.dailyEdition);
          if (showDaily) {
            setDailyQtyByEdition((prev) =>
              Object.keys(prev).length > 0
                ? prev
                : { [d.dailyEdition!.number]: initialTicketKind === "daily" ? 1 : 0 },
            );
          }
        } else if (r.ok) {
          setCurrentDailyEdition(null);
        }
        if (r.ok && d.skaleDailyEdition) {
          setCurrentSkaleDailyEdition(d.skaleDailyEdition);
          if (showDaily) {
            setSkaleDailyQtyByEdition((prev) =>
              Object.keys(prev).length > 0
                ? prev
                : {
                    [d.skaleDailyEdition!.number]: initialSkaleDaily ? 1 : 0,
                  },
            );
          }
        } else if (r.ok) {
          setCurrentSkaleDailyEdition(null);
        }
        if (r.ok && Array.isArray(d.extraBoloes) && d.extraBoloes.length > 0 && showExtra) {
          setExtraBoloes(
            filterTicketShopExtraBoloes(
              d.extraBoloes.map((row) => applyTicketShopExtraCatalogItem(row)),
            ),
          );
        }
        if (r.ok && Array.isArray(d.catalogBoloes) && d.catalogBoloes.length > 0) {
          setCatalogBoloes(
            d.catalogBoloes.filter((item) => item.purchaseOpen !== false),
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
  }, [showDaily, showExtra, initialTicketKind, initialSkaleDaily]);

  // SSE — canal primário (funciona em dev; pode não funcionar em serverless multi-instância)
  useEffect(() => {
    if (step !== "pix" || !transactionId) return;
    console.log("[PIX] abrindo SSE para", transactionId);
    const es = new EventSource(
      `/api/deposits/transactions/${transactionId}/events`,
    );
    es.onopen = () => console.log("[PIX] SSE conectado");
    es.onerror = (e) => console.warn("[PIX] SSE erro", e);
    es.addEventListener("transaction", (evt) => {
      try {
        const payload = JSON.parse(
          (evt as MessageEvent).data,
        ) as TransactionUpdatePayload;
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
          "poll",
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

  const extraQty = useCallback(
    (championshipId: number) => extraQtyByChampionship[championshipId] ?? 0,
    [extraQtyByChampionship],
  );

  const setExtraQty = useCallback((championshipId: number, qty: number) => {
    setExtraQtyByChampionship((prev) => ({
      ...prev,
      [championshipId]: Math.max(0, Math.min(MAX_QTY, qty)),
    }));
  }, []);

  const extraTotalQty = useMemo(
    () => extraBoloes.reduce((sum, b) => sum + extraQty(b.championshipId), 0),
    [extraBoloes, extraQty],
  );

  const extraBolaoHeadline = useCallback((b: ExtraBolaoOption) => {
    const pin = getTicketShopExtraPresentation(b.championshipId);
    const base = (
      pin?.headlineName ??
      resolveExtraBolaoDisplayName(b.championshipId, b.displayName) ??
      "Bolão extra"
    ).trim();
    let headline = `Bolão ${base.toUpperCase()}`;
    const round =
      pin?.roundLabel ??
      (b.roundLabel?.trim() ||
        (b.roundNumber != null && Number.isFinite(b.roundNumber)
          ? `${b.roundNumber}ª Rodada`
          : ""));
    if (round) headline = `${headline} · ${round}`;
    return headline;
  }, []);

  const principalLineCents = progressiveDiscountTotalCents(
    prices.general,
    principalQty,
  );
  const diarioLineCents = useMemo(() => {
    if (!currentDailyEdition) return 0;
    const q = dailyEditionQty(currentDailyEdition.number);
    return progressiveDiscountTotalCents(prices.daily, q);
  }, [currentDailyEdition, dailyEditionQty, prices.daily]);
  const skaleDiarioLineCents = useMemo(() => {
    if (!currentSkaleDailyEdition) return 0;
    const q = skaleDailyEditionQty(currentSkaleDailyEdition.number);
    return progressiveDiscountTotalCents(prices.skaleDaily, q);
  }, [currentSkaleDailyEdition, skaleDailyEditionQty, prices.skaleDaily]);
  const skaleDailyTotalQty = useMemo(
    () => Object.values(skaleDailyQtyByEdition).reduce((s, q) => s + q, 0),
    [skaleDailyQtyByEdition],
  );
  const dailyTotalQty = useMemo(
    () => Object.values(dailyQtyByEdition).reduce((s, q) => s + q, 0),
    [dailyQtyByEdition],
  );
  const extraLinesCents = useMemo(() => {
    let total = 0;
    for (const b of extraBoloes) {
      const q = extraQty(b.championshipId);
      total += progressiveDiscountTotalCents(prices.extra, q);
    }
    return total;
  }, [extraBoloes, extraQty, prices.extra]);

  const artilheirosLineCents = useMemo(
    () =>
      showArtilheiros
        ? progressiveDiscountTotalCents(prices.artilheiros, artilheirosQty)
        : 0,
    [showArtilheiros, prices.artilheiros, artilheirosQty],
  );
  const artilheirosDiscountPct = progressiveDiscountPercent(artilheirosQty);
  const artilheirosUnitPriceCents =
    artilheirosQty > 0
      ? Math.round(artilheirosLineCents / artilheirosQty)
      : prices.artilheiros;

  const extraPixLines = useMemo(
    () =>
      extraBoloes
        .map((b) => {
          const qty = extraQty(b.championshipId);
          if (qty <= 0) return null;
          const lineCents = progressiveDiscountTotalCents(prices.extra, qty);
          const label =
            resolveExtraBolaoDisplayName(b.championshipId, b.displayName) ||
            "Bolão extra";
          return {
            championshipId: b.championshipId,
            qty,
            lineCents,
            displayLabel: `Ticket ${label}`,
          };
        })
        .filter((line): line is NonNullable<typeof line> => line != null),
    [extraBoloes, extraQty, prices.extra],
  );

  const catalogLinesCents = useMemo(() => {
    let total = 0;
    for (const item of catalogBoloes) {
      const q = catalogQty(item.id);
      total += progressiveDiscountTotalCents(item.unitPriceCents, q);
    }
    return total;
  }, [catalogBoloes, catalogQty]);
  const catalogTotalQty = useMemo(
    () => Object.values(catalogQtyById).reduce((s, q) => s + q, 0),
    [catalogQtyById],
  );

  const totalCents =
    principalLineCents +
    diarioLineCents +
    skaleDiarioLineCents +
    extraLinesCents +
    artilheirosLineCents +
    catalogLinesCents;
  const totalQty =
    principalQty +
    dailyTotalQty +
    skaleDailyTotalQty +
    extraTotalQty +
    catalogTotalQty +
    (showArtilheiros ? artilheirosQty : 0);
  const hasSelection = totalCents > 0 && totalQty >= 1;
  const geralDiscountPct = progressiveDiscountPercent(principalQty);
  const principalUnitPriceCents =
    principalQty > 0
      ? Math.round(principalLineCents / principalQty)
      : prices.general;
  const dailyUnitPriceCents =
    dailyTotalQty > 0 ? Math.round(diarioLineCents / dailyTotalQty) : prices.daily;
  const dailyPixLines = useMemo(() => {
    if (!currentDailyEdition) return [];
    const qty = dailyEditionQty(currentDailyEdition.number);
    if (qty <= 0) return [];
    return [
      {
        edition: currentDailyEdition.number,
        qty,
        lineCents: progressiveDiscountTotalCents(prices.daily, qty),
        displayLabel: currentDailyEdition.label,
        datesLabel: currentDailyEdition.datesLabel,
      },
    ];
  }, [currentDailyEdition, dailyEditionQty, prices.daily]);
  const secondsLeft =
    step === "pix" && pixDeadline != null
      ? Math.max(0, Math.ceil((pixDeadline - now) / 1000))
      : 0;
  const pixExpired = step === "pix" && pixDeadline != null && secondsLeft === 0;
  const pixProgressPct =
    step === "pix" && pixDeadline != null
      ? Math.min(100, Math.max(0, (secondsLeft / PIX_CHECKOUT_TOTAL_SEC) * 100))
      : 0;

  const goGenerate = useCallback(() => {
    if (!hasSelection) return;
    setError(null);
    setCouponHint(null);
    setStep("generating");
    void (async () => {
      try {
        const r = await fetch("/api/deposits/transactions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generalQuantity: principalQty,
            dailyQuantity: 0,
            dailyByEdition:
              showDaily && currentDailyEdition
                ? Object.fromEntries(
                    [
                      [
                        String(currentDailyEdition.number),
                        dailyEditionQty(currentDailyEdition.number),
                      ] as const,
                    ].filter(([, q]) => q > 0),
                  )
                : {},
            skaleDailyByEdition:
              showDaily && currentSkaleDailyEdition
                ? Object.fromEntries(
                    [
                      [
                        String(currentSkaleDailyEdition.number),
                        skaleDailyEditionQty(currentSkaleDailyEdition.number),
                      ] as const,
                    ].filter(([, q]) => q > 0),
                  )
                : {},
            ...(showExtra
              ? {
                  extraByChampionship: Object.fromEntries(
                    extraBoloes
                      .map(
                        (b) =>
                          [
                            String(b.championshipId),
                            extraQty(b.championshipId),
                          ] as const,
                      )
                      .filter(([, q]) => q > 0),
                  ),
                }
              : {}),
            ...(showArtilheiros && artilheirosQty > 0
              ? { artilheirosQuantity: artilheirosQty }
              : { artilheirosQuantity: 0 }),
            ...(catalogTotalQty > 0
              ? {
                  definitionsById: Object.fromEntries(
                    catalogBoloes
                      .map((item) => [item.id, catalogQty(item.id)] as const)
                      .filter(([, q]) => q > 0),
                  ),
                }
              : {}),
          }),
        });
        const d = (await r.json()) as {
          error?: string;
          transaction?: DepositTransaction;
        };
        if (!r.ok || !d.transaction || !d.transaction.pixQrcode) {
          setError(d.error ?? "Nao foi possivel gerar o PIX.");
          setStep("shop");
          return;
        }
        purchasePrincipalRef.current = principalQty;
        purchaseDiarioRef.current = dailyTotalQty;
        purchaseExtraRef.current = Object.fromEntries(
          extraBoloes
            .map((b) => [b.championshipId, extraQty(b.championshipId)] as const)
            .filter(([, q]) => q > 0),
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
  }, [
    hasSelection,
    principalQty,
    currentDailyEdition,
    dailyEditionQty,
    dailyTotalQty,
    extraBoloes,
    extraQty,
    showArtilheiros,
    artilheirosQty,
  ]);

  const copyPix = useCallback(() => {
    if (!pixPayload || pixExpired) return;
    void navigator.clipboard.writeText(pixPayload);
  }, [pixPayload, pixExpired]);

  const goBackFromPix = useCallback(() => {
    setStep("shop");
    setPixPayload("");
    setTransactionId(null);
    setPixDeadline(null);
    setConfirmedPaid(false);
    paidHandledRef.current = false;
    setError(null);
  }, []);

  const handleVerifyPaidClick = useCallback(async () => {
    if (!transactionId || checkingManually) return;
    setCheckingManually(true);
    try {
      const r = await fetch(`/api/deposits/transactions/${transactionId}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await r.json()) as {
        transaction?: DepositTransaction;
      };
      if (r.ok && data.transaction) {
        console.log(
          "[PIX] verificação manual status:",
          data.transaction.status,
        );
        handleTransactionUpdate(
          {
            status: data.transaction.status,
            pixQrcode: data.transaction.pixQrcode,
          },
          "manual",
        );
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

  return (
    <>
      {step === "shop" ? (
        !catalogReady ? (
          <AppScreenLoading
            variant="app-shell"
            message="Carregando bolões e valores..."
            className="w-full flex-1"
          />
        ) : (
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

              <div className="space-y-3">
                {showPrincipal && (
                  <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#121212] shadow-[0_8px_26px_rgba(0,0,0,0.35)]">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3 sm:p-3.5">
                      <div className={TICKET_CARD_LOGO_WRAP_CLASS}>
                        <Image
                          src={iconCopaMundo}
                          alt=""
                          className={TICKET_CARD_LOGO_CLASS}
                        />
                      </div>

                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
                        <div className="min-w-0">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="whitespace-nowrap text-[14px] font-black uppercase leading-tight text-white sm:text-[15px]">
                                Bolão do Milhão
                              </h3>
                              <span className="w-fit shrink-0 rounded-md bg-primary/20 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-primary sm:text-[8px]">
                                Mais popular
                              </span>
                            </div>
                            <p className="mt-1 text-[12px] font-medium leading-snug text-white/80 sm:text-[11px]">
                              Acesso a todas as rodadas da Copa do Mundo 2026
                            </p>
                          </div>

                          <div className="mt-3 flex w-fit items-center gap-1 rounded-[10px] border border-white/10 bg-[#0f0f0f] p-1">
                            <button
                              type="button"
                              aria-label="Diminuir Bolão Geral"
                              disabled={principalQty <= 0}
                              onClick={() => {
                                setError(null);
                                setCouponHint(null);
                                setPrincipalQty((q) => Math.max(0, q - 1));
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/20 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                            >
                              <span className="text-[18px] font-black leading-none">
                                -
                              </span>
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
                                setPrincipalQty((q) =>
                                  Math.min(MAX_QTY, q + 1),
                                );
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/30 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                            >
                              <span className="text-[18px] font-black leading-none">
                                +
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="self-center text-right">
                          <p className="text-[12px] font-semibold text-white/40">
                            Preço unitário
                          </p>
                          <p className="mt-1 text-[14px] font-black tabular-nums text-white sm:text-[15px]">
                            {formatBRL(principalUnitPriceCents)}
                          </p>
                          <p className="mt-1 text-[12px] font-semibold tabular-nums text-white/80 line-through">
                            {geralDiscountPct > 0
                              ? formatBRL(prices.general)
                              : ""}
                          </p>
                          <p className="text-[12px] font-bold text-primary">
                            {geralDiscountPct}% OFF
                          </p>
                          <p className="mt-1 text-[9px] leading-tight text-white/40">
                            a partir de 2 tickets
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-white/6 bg-black/25 px-3.5 py-2.5 text-[12px] text-white/50 sm:px-4">
                      <span>
                        Desconto aplicado:{" "}
                        <span className="font-bold text-primary">
                          {geralDiscountPct}%
                        </span>{" "}
                        OFF
                      </span>
                      <span className="inline-flex items-center gap-1 text-right font-medium">
                        Escolha a quantidade
                      </span>
                    </div>
                  </div>
                )}

                {showDaily && currentDailyEdition && (
                  <div className="space-y-3">
                    {(() => {
                      const edition = currentDailyEdition;
                      const qty = dailyEditionQty(edition.number);
                      const closed = !edition.purchaseOpen;
                      const lineCents = progressiveDiscountTotalCents(
                        prices.daily,
                        qty,
                      );
                      const discountPct = progressiveDiscountPercent(qty);
                      const unitCents =
                        qty > 0 ? Math.round(lineCents / qty) : prices.daily;
                      const statusLabel =
                        edition.status === "encerrado"
                          ? "Encerrado"
                          : edition.status === "em_breve"
                            ? "Em breve"
                            : "Aberto";

                      return (
                        <div
                          key={edition.number}
                          className={`overflow-hidden rounded-[16px] border bg-[#121212] shadow-[0_8px_26px_rgba(0,0,0,0.35)] ${
                            closed
                              ? "border-white/8 opacity-70"
                              : "border-white/10"
                          }`}
                        >
                          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3 sm:p-3.5">
                            <div className={TICKET_CARD_LOGO_WRAP_CLASS}>
                              <Image
                                src={logoBolaoDiario}
                                alt="Bolão Diário"
                                className={TICKET_CARD_LOGO_CLASS}
                              />
                            </div>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h3 className="text-[14px] font-black uppercase leading-tight text-white sm:text-[15px]">
                                    {edition.label}
                                  </h3>
                                  <span
                                    className={`w-fit shrink-0 rounded-md px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide sm:text-[8px] ${
                                      closed
                                        ? "bg-red-500/15 text-red-300"
                                        : edition.status === "em_breve"
                                          ? "bg-white/10 text-white/60"
                                          : "bg-primary/20 text-primary"
                                    }`}
                                  >
                                    {statusLabel}
                                  </span>
                                </div>
                                <p className="mt-1 text-[12px] font-semibold leading-snug text-primary/90 sm:text-[11px]">
                                  {edition.datesLabel}
                                </p>
                                <p className="mt-1 text-[12px] font-medium leading-snug text-white/55">
                                  Palpites em todos os jogos destes dias
                                </p>
                                <div className="mt-3 flex w-fit items-center gap-1 rounded-[10px] border border-white/10 bg-[#0f0f0f] p-1">
                                  <button
                                    type="button"
                                    aria-label={`Diminuir ${edition.label}`}
                                    disabled={closed || qty <= 0}
                                    onClick={() => {
                                      setError(null);
                                      setCouponHint(null);
                                      setDailyEditionQty(edition.number, qty - 1);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/20 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                                  >
                                    <span className="text-[18px] font-black leading-none">
                                      -
                                    </span>
                                  </button>
                                  <span className="w-8 text-center text-[18px] font-black tabular-nums text-white sm:text-[20px]">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Aumentar ${edition.label}`}
                                    disabled={closed || qty >= MAX_QTY}
                                    onClick={() => {
                                      setError(null);
                                      setCouponHint(null);
                                      setDailyEditionQty(edition.number, qty + 1);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/30 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                                  >
                                    <span className="text-[18px] font-black leading-none">
                                      +
                                    </span>
                                  </button>
                                </div>
                              </div>
                              <div className="self-center text-right">
                                <p className="text-[12px] font-semibold text-white/40">
                                  Preço unitário
                                </p>
                                <p className="mt-1 text-[14px] font-black tabular-nums text-white sm:text-[15px]">
                                  {formatBRL(unitCents)}
                                </p>
                                <p className="mt-1 text-[12px] font-semibold tabular-nums text-white/80 line-through">
                                  {discountPct > 0 ? formatBRL(prices.daily) : ""}
                                </p>
                                <p className="text-[12px] font-bold text-primary">
                                  {discountPct > 0 ? `${discountPct}% OFF` : ""}
                                </p>
                              </div>
                            </div>
                          </div>
                          {closed && (
                            <div className="border-t border-white/6 bg-black/25 px-3.5 py-2 text-[11px] font-medium text-white/45 sm:px-4">
                              Esta edição já encerrou — não é possível comprar.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {showDaily && currentSkaleDailyEdition && (
                  <div className="space-y-3">
                    {(() => {
                      const edition = currentSkaleDailyEdition;
                      const qty = skaleDailyEditionQty(edition.number);
                      const closed = !edition.purchaseOpen;
                      const lineCents = progressiveDiscountTotalCents(
                        prices.skaleDaily,
                        qty,
                      );
                      const discountPct = progressiveDiscountPercent(qty);
                      const unitCents =
                        qty > 0 ? Math.round(lineCents / qty) : prices.skaleDaily;
                      const statusLabel =
                        edition.status === "encerrado"
                          ? "Encerrado"
                          : edition.status === "em_breve"
                            ? "Em breve"
                            : "Aberto";

                      return (
                        <div
                          key={`skale-${edition.number}`}
                          className={`overflow-hidden rounded-[16px] border bg-[#121212] shadow-[0_8px_26px_rgba(0,0,0,0.35)] ${
                            closed
                              ? "border-white/8 opacity-70"
                              : "border-white/10"
                          }`}
                        >
                          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3 sm:p-3.5">
                            <div className={TICKET_CARD_LOGO_WRAP_CLASS}>
                              <Image
                                src={skaleLogo}
                                alt="Bolão Diário Skale"
                                className={TICKET_CARD_LOGO_CLASS}
                              />
                            </div>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h3 className="text-[14px] font-black uppercase leading-tight text-white sm:text-[15px]">
                                    {edition.label}
                                  </h3>
                                  <span
                                    className={`w-fit shrink-0 rounded-md px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide sm:text-[8px] ${
                                      closed
                                        ? "bg-red-500/15 text-red-300"
                                        : edition.status === "em_breve"
                                          ? "bg-white/10 text-white/60"
                                          : "bg-primary/20 text-primary"
                                    }`}
                                  >
                                    {statusLabel}
                                  </span>
                                </div>
                                <p className="mt-1 text-[12px] font-semibold leading-snug text-primary/90 sm:text-[11px]">
                                  {edition.datesLabel}
                                </p>
                                <p className="mt-1 text-[12px] font-medium leading-snug text-white/55">
                                  Palpites em todos os jogos destes dias
                                </p>
                                <div className="mt-3 flex w-fit items-center gap-1 rounded-[10px] border border-white/10 bg-[#0f0f0f] p-1">
                                  <button
                                    type="button"
                                    aria-label={`Diminuir ${edition.label}`}
                                    disabled={closed || qty <= 0}
                                    onClick={() => {
                                      setError(null);
                                      setCouponHint(null);
                                      setSkaleDailyEditionQty(edition.number, qty - 1);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/20 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                                  >
                                    <span className="text-[18px] font-black leading-none">
                                      -
                                    </span>
                                  </button>
                                  <span className="w-8 text-center text-[18px] font-black tabular-nums text-white sm:text-[20px]">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Aumentar ${edition.label}`}
                                    disabled={closed || qty >= MAX_QTY}
                                    onClick={() => {
                                      setError(null);
                                      setCouponHint(null);
                                      setSkaleDailyEditionQty(edition.number, qty + 1);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/30 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                                  >
                                    <span className="text-[18px] font-black leading-none">
                                      +
                                    </span>
                                  </button>
                                </div>
                              </div>
                              <div className="self-center text-right">
                                <p className="text-[12px] font-semibold text-white/40">
                                  Preço unitário
                                </p>
                                <p className="mt-1 text-[14px] font-black tabular-nums text-white sm:text-[15px]">
                                  {formatBRL(unitCents)}
                                </p>
                                <p className="mt-1 text-[12px] font-semibold tabular-nums text-white/80 line-through">
                                  {discountPct > 0 ? formatBRL(prices.skaleDaily) : ""}
                                </p>
                                <p className="text-[12px] font-bold text-primary">
                                  {discountPct > 0 ? `${discountPct}% OFF` : ""}
                                </p>
                              </div>
                            </div>
                          </div>
                          {closed && (
                            <div className="border-t border-white/6 bg-black/25 px-3.5 py-2 text-[11px] font-medium text-white/45 sm:px-4">
                              Esta edição já encerrou — não é possível comprar.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {showDaily && !currentDailyEdition && catalogReady && (
                  <div className="rounded-[16px] border border-white/10 bg-[#121212] px-4 py-5 text-center">
                    <p className="text-[13px] font-bold text-white/70">
                      Nenhuma cota do bolão diário disponível no momento.
                    </p>
                    <p className="mt-1 text-[11px] text-white/45">
                      Volte em breve para a próxima edição da fase de grupos.
                    </p>
                  </div>
                )}

                {showArtilheiros && (
                  <div className="overflow-hidden rounded-[16px] border border-white/10 bg-[#121212] shadow-[0_8px_26px_rgba(0,0,0,0.35)]">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3 sm:p-3.5">
                      <div className={TICKET_CARD_LOGO_WRAP_CLASS}>
                        <Image
                          src={iconeBolaoArtilheiro}
                          alt=""
                          className={TICKET_CARD_LOGO_CLASS}
                        />
                      </div>

                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="whitespace-nowrap text-[14px] font-black uppercase leading-tight text-white sm:text-[15px]">
                              Bolão dos Artilheiros
                            </h3>
                            <span className="w-fit shrink-0 rounded-md bg-primary/20 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-primary sm:text-[8px]">
                              Novo
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] font-medium leading-snug text-white/80 sm:text-[11px]">
                            Palpite os 3 artilheiros da Copa do Mundo 2026
                          </p>

                          <div className="mt-3 flex w-fit items-center gap-1 rounded-[10px] border border-white/10 bg-[#0f0f0f] p-1">
                            <button
                              type="button"
                              aria-label="Diminuir Bolão dos Artilheiros"
                              disabled={artilheirosQty <= 0}
                              onClick={() => {
                                setError(null);
                                setCouponHint(null);
                                setArtilheirosQty((q) => Math.max(0, q - 1));
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/20 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                            >
                              <span className="text-[18px] font-black leading-none">
                                -
                              </span>
                            </button>
                            <span className="w-8 text-center text-[18px] font-black tabular-nums text-white sm:text-[20px]">
                              {artilheirosQty}
                            </span>
                            <button
                              type="button"
                              aria-label="Aumentar Bolão dos Artilheiros"
                              disabled={artilheirosQty >= MAX_QTY}
                              onClick={() => {
                                setError(null);
                                setCouponHint(null);
                                setArtilheirosQty((q) => Math.min(MAX_QTY, q + 1));
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/30 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                            >
                              <span className="text-[18px] font-black leading-none">
                                +
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="self-center text-right">
                          <p className="text-[12px] font-semibold text-white/40">
                            Preço unitário
                          </p>
                          <p className="mt-1 text-[14px] font-black tabular-nums text-white sm:text-[15px]">
                            {formatBRL(artilheirosUnitPriceCents)}
                          </p>
                          <p className="mt-1 text-[12px] font-semibold tabular-nums text-white/80 line-through">
                            {artilheirosDiscountPct > 0
                              ? formatBRL(prices.artilheiros)
                              : ""}
                          </p>
                          <p className="text-[12px] font-bold text-primary">
                            {artilheirosDiscountPct > 0
                              ? `${artilheirosDiscountPct}% OFF`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-white/6 bg-black/25 px-3.5 py-2.5 text-[12px] text-white/50 sm:px-4">
                      <span>
                        Desconto aplicado:{" "}
                        <span className="font-bold text-primary">
                          {artilheirosDiscountPct}%
                        </span>{" "}
                        OFF
                      </span>
                      <span className="inline-flex items-center gap-1 text-right font-medium">
                        Escolha a quantidade
                      </span>
                    </div>
                  </div>
                )}

                {showExtra &&
                  extraBoloes.map((b) => {
                    const qty = extraQty(b.championshipId);
                    const variant = getExtraBolaoHeroSideVariant(
                      b.championshipId,
                      b.displayName,
                    );
                    const iconSrc = extraBolaoIconSrc(variant).src;
                    const branded = isExtraBolaoBrandedIcon(variant);
                    const headline = extraBolaoHeadline(b);
                    const lineCents = progressiveDiscountTotalCents(
                      prices.extra,
                      qty,
                    );
                    const discountPct = progressiveDiscountPercent(qty);
                    const unitCents =
                      qty > 0 ? Math.round(lineCents / qty) : prices.extra;

                    return (
                      <div
                        key={b.championshipId}
                        className="overflow-hidden rounded-[16px] border border-white/10 bg-[#121212] shadow-[0_8px_26px_rgba(0,0,0,0.35)]"
                      >
                        <div className="min-w-0 overflow-x-auto border-b border-white/6 px-3 pb-2.5 pt-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-3.5 sm:pb-3 sm:pt-3.5 [&::-webkit-scrollbar]:hidden">
                          <h3 className="inline-block w-max max-w-none whitespace-nowrap text-[14px] font-black uppercase leading-none tracking-[-0.03em] text-white min-[380px]:text-[15px] sm:text-[15px]">
                            {headline}
                          </h3>
                        </div>
                        <div className="grid grid-cols-[74px_minmax(0,1fr)] items-start gap-3 p-3 sm:grid-cols-[86px_minmax(0,1fr)] sm:p-3.5">
                          <div className="flex flex-col items-center justify-center pt-0.5">
                            <img
                              src={iconSrc}
                              alt=""
                              className={
                                branded
                                  ? "h-[68px] w-[68px] shrink-0 object-contain sm:h-[78px] sm:w-[78px]"
                                  : "h-[82px] w-[62px] shrink-0 object-contain sm:h-[86px] sm:w-[62px]"
                              }
                            />
                          </div>
                          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_96px]">
                            <div className="min-w-0">
                              <p className="text-[12px] font-medium leading-snug text-white/80 sm:text-[11px]">
                                Cota extra na rodada atual deste campeonato.
                              </p>
                              <p className="mt-1.5 text-[11px] font-bold leading-snug text-primary/90 sm:text-[12px]">
                                {getExtraBolaoFirstPlaceLine(
                                  b.championshipId,
                                  b.displayName,
                                )}
                              </p>
                              <div className="mt-3 flex w-fit items-center gap-1 rounded-[10px] border border-white/10 bg-[#0f0f0f] p-1">
                                <button
                                  type="button"
                                  aria-label={`Diminuir ${headline}`}
                                  disabled={qty <= 0}
                                  onClick={() => {
                                    setError(null);
                                    setCouponHint(null);
                                    setExtraQty(b.championshipId, qty - 1);
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/20 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                                >
                                  <span className="text-[18px] font-black leading-none">
                                    -
                                  </span>
                                </button>
                                <span className="w-8 text-center text-[18px] font-black tabular-nums text-white sm:text-[20px]">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Aumentar ${headline}`}
                                  disabled={qty >= MAX_QTY}
                                  onClick={() => {
                                    setError(null);
                                    setCouponHint(null);
                                    setExtraQty(b.championshipId, qty + 1);
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/30 bg-black/40 text-primary transition-colors hover:bg-white/10 disabled:opacity-30"
                                >
                                  <span className="text-[18px] font-black leading-none">
                                    +
                                  </span>
                                </button>
                              </div>
                            </div>
                            <div className="self-center text-right">
                              <p className="text-[12px] font-semibold text-white/40">
                                Preço unitário
                              </p>
                              <p className="mt-1 text-[14px] font-black tabular-nums text-white sm:text-[15px]">
                                {formatBRL(unitCents)}
                              </p>
                              <p className="mt-1 text-[12px] font-semibold tabular-nums text-white/80 line-through">
                                {discountPct > 0 ? formatBRL(prices.extra) : ""}
                              </p>
                              <p className="text-[12px] font-bold text-primary">
                                {discountPct}% OFF
                              </p>
                              <p className="mt-1 text-[9px] leading-tight text-white/40">
                                a partir de 2 tickets
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-white/6 bg-black/25 px-3.5 py-2.5 text-[12px] text-white/50 sm:px-4">
                          <span>
                            Desconto aplicado:{" "}
                            <span className="font-bold text-primary">
                              {discountPct}%
                            </span>{" "}
                            OFF
                          </span>
                          <span className="inline-flex items-center gap-1 text-right font-medium">
                            Escolha a quantidade
                          
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {catalogBoloes.length > 0
                  ? catalogBoloes.map((item) => {
                      const qty = catalogQty(item.id);
                      const lineCents = progressiveDiscountTotalCents(
                        item.unitPriceCents,
                        qty,
                      );
                      const discountPct = progressiveDiscountPercent(qty);
                      const unitCents =
                        qty > 0 ? Math.round(lineCents / qty) : item.unitPriceCents;
                      const iconSrc = item.resolvedLogoUrl
                        ? item.resolvedLogoUrl
                        : extraBolaoIconSrc(
                            item.resolvedIconVariant as Parameters<
                              typeof extraBolaoIconSrc
                            >[0],
                          ).src;

                      return (
                        <div
                          key={item.id}
                          className="overflow-hidden rounded-[16px] border border-primary/20 bg-[#121212] shadow-[0_8px_26px_rgba(0,0,0,0.35)]"
                        >
                          <div className="border-b border-white/6 px-3 pb-2.5 pt-3 sm:px-3.5">
                            <h3 className="text-[14px] font-black uppercase tracking-tight text-white sm:text-[15px]">
                              {item.displayName}
                            </h3>
                            {item.datesLabel ? (
                              <p className="mt-1 text-[11px] font-medium text-white/45">
                                {item.datesLabel}
                              </p>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-[74px_minmax(0,1fr)] items-start gap-3 p-3 sm:grid-cols-[86px_minmax(0,1fr)] sm:p-3.5">
                            <div className="flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={iconSrc}
                                alt=""
                                className="h-[68px] w-[68px] object-contain sm:h-[78px] sm:w-[78px]"
                              />
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-[12px] font-semibold text-white/50">
                                  {item.subtitle ?? "Bolão especial"}
                                </p>
                                <p className="mt-1 text-[18px] font-black tabular-nums text-white">
                                  {item.priceLabel}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  disabled={qty <= 0}
                                  onClick={() => setCatalogQty(item.id, qty - 1)}
                                  className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white disabled:opacity-30"
                                >
                                  −
                                </button>
                                <span className="min-w-[1.5rem] text-center text-[16px] font-black tabular-nums text-white">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  disabled={qty >= MAX_QTY}
                                  onClick={() => setCatalogQty(item.id, qty + 1)}
                                  className="flex size-9 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                              <div className="text-right">
                                <p className="text-[12px] font-semibold text-white/40">
                                  Unitário
                                </p>
                                <p className="text-[14px] font-black tabular-nums text-white">
                                  {formatBRL(unitCents)}
                                </p>
                                {discountPct > 0 ? (
                                  <p className="text-[11px] font-bold text-primary">
                                    {discountPct}% OFF
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  : null}
              </div>

              {/* ── Resumo da compra ─────────────────────────────── */}
              <div className="rounded-[16px] border border-white/8 bg-[#171717] p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-black/40">
                      <ShoppingCart
                        className="size-[18px] text-primary"
                        strokeWidth={2.2}
                      />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-black tracking-tight text-white">
                        Resumo da compra
                      </h3>
                      <p className="text-[11px] font-medium text-white/40">
                        Revise antes de gerar o PIX
                      </p>
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
                        setCouponHint(
                          "Cupons em breve — fique de olho nas promoções.",
                        );
                        setCouponCode("");
                      }}
                      className="h-9 rounded-[9px] bg-white/10 text-[12px] font-bold text-white transition-colors hover:bg-white/15"
                    >
                      Aplicar
                    </button>
                    {couponHint && (
                      <p className="text-[11px] font-medium text-primary/90">
                        {couponHint}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2.5 border-b border-white/10 pb-3">
                  {showPrincipal && principalQty > 0 && (
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="font-semibold text-white/70">
                        Bolão Geral · {principalQty}{" "}
                        {principalQty === 1 ? "ticket" : "tickets"}
                      </span>
                      <span className="shrink-0 font-black tabular-nums text-white">
                        {formatBRL(principalLineCents)}
                      </span>
                    </div>
                  )}
                  {showDaily &&
                    dailyPixLines.map((line) => (
                      <div
                        key={line.edition}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="font-semibold text-white/70">
                          {line.displayLabel} · {line.qty}{" "}
                          {line.qty === 1 ? "ticket" : "tickets"}
                        </span>
                        <span className="shrink-0 font-black tabular-nums text-white">
                          {formatBRL(line.lineCents)}
                        </span>
                      </div>
                    ))}
                  {showArtilheiros && artilheirosQty > 0 && (
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="font-semibold text-white/70">
                        Bolão dos Artilheiros · {artilheirosQty}{" "}
                        {artilheirosQty === 1 ? "ticket" : "tickets"}
                      </span>
                      <span className="shrink-0 font-black tabular-nums text-white">
                        {formatBRL(artilheirosLineCents)}
                      </span>
                    </div>
                  )}
                  {showExtra &&
                    extraBoloes.map((b) => {
                      const qty = extraQty(b.championshipId);
                      if (qty <= 0) return null;
                      const lineCents = progressiveDiscountTotalCents(
                        prices.extra,
                        qty,
                      );
                      const label =
                        resolveExtraBolaoDisplayName(
                          b.championshipId,
                          b.displayName,
                        ) || "Bolão extra";
                      return (
                        <div
                          key={b.championshipId}
                          className="flex items-center justify-between gap-2 text-[13px]"
                        >
                          <span className="font-semibold text-white/70">
                            {label} · {qty} {qty === 1 ? "ticket" : "tickets"}
                          </span>
                          <span className="shrink-0 font-black tabular-nums text-white">
                            {formatBRL(lineCents)}
                          </span>
                        </div>
                      );
                    })}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[16px] font-black uppercase tracking-wide text-white/50">
                    Total
                  </span>
                  <span className="text-[18px] font-black tabular-nums text-primary">
                    {formatBRL(totalCents)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={goGenerate}
                  className="mt-4 flex h-[56px] w-full items-center justify-center gap-3 rounded-[14px] bg-primary px-5 text-[16px] font-black uppercase tracking-[0.04em] text-[#0E141B] shadow-[0_4px_32px_rgba(177,235,11,0.55)] transition-[transform,filter] hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 sm:text-[14px]"
                >
                  <Wallet className="size-5 shrink-0" strokeWidth={2.2} />
                  <span>Finalizar compra · {formatBRL(totalCents)}</span>
                  <ArrowRight className="size-5 shrink-0" strokeWidth={2.8} />
                </button>
              </div>

              {/* ── Confiança ───────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-[12px] border border-white/8 bg-[#171717] px-2 py-3 text-center sm:px-3">
                  <Shield
                    className="mx-auto size-5 text-primary"
                    strokeWidth={2}
                  />
                  <p className="mt-2 text-[12px] font-black uppercase tracking-wide text-white">
                    100% Seguro
                  </p>
                  <p className="mt-1 text-[9px] leading-snug text-white/40">
                    Seus dados protegidos com criptografia.
                  </p>
                </div>
                <div className="rounded-[12px] border border-white/8 bg-[#171717] px-2 py-3 text-center sm:px-3">
                  <Zap
                    className="mx-auto size-5 text-primary"
                    strokeWidth={2}
                  />
                  <p className="mt-2 text-[12px] font-black uppercase tracking-wide text-white">
                    Instantâneo
                  </p>
                  <p className="mt-1 text-[9px] leading-snug text-white/40">
                    Acesso liberado na hora.
                  </p>
                </div>
                <div className="rounded-[12px] border border-white/8 bg-[#171717] px-2 py-3 text-center sm:px-3">
                  <Check
                    className="mx-auto size-5 text-primary"
                    strokeWidth={2.5}
                  />
                  <p className="mt-2 text-[12px] font-black uppercase tracking-wide text-white">
                    Sem taxas
                  </p>
                  <p className="mt-1 text-[9px] leading-snug text-white/40">
                    Você paga apenas pelo ticket.
                  </p>
                </div>
              </div>

              {/* ── Botão depositar ──────────────────────────────── */}

              {error && (
                <p className="text-center text-[12px] font-semibold text-red-300">
                  {error}
                </p>
              )}
              <p className="flex items-center justify-center gap-2 text-center text-[11px] font-medium text-white/25">
                <Lock className="size-3 shrink-0" strokeWidth={2} />
                Transação protegida por criptografia SSL 256-bit
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="min-h-screen w-full bg-black">
          {step === "generating" && <TicketPixGeneratingPanel />}
          {step === "pix" && pixPayload && (
            <TicketPixGeneratedScreen
              pixPayload={pixPayload}
              secondsLeft={secondsLeft}
              pixExpired={pixExpired}
              pixProgressPct={pixProgressPct}
              onCopy={copyPix}
              onBack={goBackFromPix}
              onVerifyPaid={() => void handleVerifyPaidClick()}
              checkingManually={checkingManually}
              confirmedPaid={confirmedPaid}
              error={error}
              principalQty={principalQty}
              dailyQty={dailyTotalQty}
              artilheirosQty={showArtilheiros ? artilheirosQty : 0}
              artilheirosLineCents={artilheirosLineCents}
              artilheirosUnitPriceCents={artilheirosUnitPriceCents}
              dailyPixLines={dailyPixLines}
              extraPixLines={extraPixLines}
              prices={prices}
              principalUnitPriceCents={principalUnitPriceCents}
              dailyUnitPriceCents={dailyUnitPriceCents}
              totalCents={totalCents}
            />
          )}
        </div>
      )}
    </>
  );
}
