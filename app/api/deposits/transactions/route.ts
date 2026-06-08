import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { createDepositTransaction, parseTicketTypeOrThrow } from "@/lib/payments/transactions";
import { getBrasilMarrocosPlacarPromoStatusForUser } from "@/lib/promotions/brasil-marrocos-placar-promo";
import { getExtraBolaoUnitCents, getTicketPriceCents } from "@/lib/payments/ticket-config";
import { resolveExtraBolaoDisplayName } from "@/lib/boloes-extra-competition-branding";
import { parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import {
  readCompetitionDisplayNamesFromDb,
  warmCompetitionMetadataCache,
} from "@/lib/competition-metadata-cache";
import { applyTicketShopExtraCatalogItem } from "@/lib/ticket-shop-extra-display";
import { filterTicketShopExtraBoloes } from "@/lib/ticket-shop-flags";
import {
  extraBolaoCurrentRoundsByChampionship,
  type ExtraBolaoRoundInfo,
} from "@/lib/ticket-shop-extra-rounds";
import { responseForDbError } from "@/lib/db-errors";
import { clientPriceFieldError, findClientPriceField } from "@/lib/payments/reject-client-price-fields";

export const runtime = "nodejs";

const extraByChampionshipSchema = z
  .record(z.string(), z.number().int().min(0).max(20))
  .optional()
  .transform((rec) => {
    if (!rec) return {} as Record<number, number>;
    const allowed = new Set(parseExtraBolaoChampionshipIds());
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(rec)) {
      const id = Number.parseInt(k, 10);
      if (!Number.isFinite(id) || !allowed.has(id)) continue;
      out[id] = v;
    }
    return out;
  });

const createCartSchema = z
  .object({
    generalQuantity: z.number().int().min(0).max(20),
    dailyQuantity: z.number().int().min(0).max(20),
    /** Quantidade total de cotas “Bolão extra” (valor calculado só no servidor). */
    extraQuantity: z.number().int().min(0).max(20).optional(),
    /** Legado — ignorado se `extraQuantity` > 0. */
    extraByChampionship: extraByChampionshipSchema,
    /** Checkout `/comprar-cotas` — preço promocional fixo (1–3 cotas gerais). */
    checkoutPromo: z.enum(["comprar-cotas"]).optional(),
  })
  .strict();

const createLegacySchema = z
  .object({
    ticketType: z.enum(["general", "daily", "extra"]),
    quantity: z.number().int().min(1).max(20).default(1),
    extraChampionshipId: z.number().int().positive().optional(),
  })
  .strict();

export async function GET() {
  const ids = parseExtraBolaoChampionshipIds();
  const unit = getExtraBolaoUnitCents();
  const [labels, rounds] = await Promise.all([
    readCompetitionDisplayNamesFromDb(ids).catch(() => ({} as Record<number, string>)),
    extraBolaoCurrentRoundsByChampionship(ids).catch(() => ({} as Record<number, ExtraBolaoRoundInfo>)),
  ]);
  void warmCompetitionMetadataCache(ids).catch(() => {});
  return NextResponse.json({
    prices: {
      general: getTicketPriceCents("general"),
      daily: getTicketPriceCents("daily"),
      extra: getExtraBolaoUnitCents(),
    },
    extraBoloes: filterTicketShopExtraBoloes(
      ids.map((championshipId) =>
        applyTicketShopExtraCatalogItem({
          championshipId,
          unitCents: unit,
          displayName: resolveExtraBolaoDisplayName(championshipId, labels[championshipId]),
          ...(rounds[championshipId]
            ? {
                roundNumber: rounds[championshipId]!.roundNumber,
                roundLabel: rounds[championshipId]!.roundLabel,
              }
            : {}),
        }),
      ),
    ),
  });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  let userId: string | null;
  try {
    userId = await verifySessionToken(token);
  } catch {
    return NextResponse.json({ error: "Sessao invalida" }, { status: 401 });
  }
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const raw = json as Record<string, unknown>;
  const rejectedPriceField = findClientPriceField(raw);
  if (rejectedPriceField) {
    return NextResponse.json({ error: clientPriceFieldError(rejectedPriceField) }, { status: 400 });
  }

  const looksLikeCart =
    typeof raw.generalQuantity === "number" && typeof raw.dailyQuantity === "number";

  try {
    if (looksLikeCart) {
      const parsed = createCartSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Dados invalidos" },
          { status: 400 }
        );
      }
      const { generalQuantity, dailyQuantity, extraQuantity, extraByChampionship, checkoutPromo } =
        parsed.data;
      const extra = extraByChampionship ?? {};
      const exQ = Math.max(0, Math.min(20, extraQuantity ?? 0));
      const extraTotalLegacy = Object.values(extra).reduce((a, b) => a + b, 0);
      if (generalQuantity + dailyQuantity + (exQ > 0 ? exQ : extraTotalLegacy) < 1) {
        return NextResponse.json({ error: "Selecione pelo menos um ticket" }, { status: 400 });
      }
      if (checkoutPromo === "comprar-cotas") {
        if (generalQuantity < 1 || generalQuantity > 3) {
          return NextResponse.json(
            { error: "Promo comprar-cotas aceita entre 1 e 3 cotas gerais" },
            { status: 400 },
          );
        }
        if (dailyQuantity > 0 || exQ > 0 || extraTotalLegacy > 0) {
          return NextResponse.json(
            { error: "Promo comprar-cotas aceita apenas cotas do bolao principal" },
            { status: 400 },
          );
        }
        const promoStatus = await getBrasilMarrocosPlacarPromoStatusForUser(userId);
        if (!promoStatus.alreadySubmitted) {
          return NextResponse.json(
            { error: "Registre seu palpite antes de comprar a cota promocional." },
            { status: 403 },
          );
        }
        if (promoStatus.promoActivated) {
          return NextResponse.json(
            { error: "Sua participação na promoção já está ativa." },
            { status: 409 },
          );
        }
      }
      const transaction = await createDepositTransaction({
        userId,
        generalQty: generalQuantity,
        dailyQty: dailyQuantity,
        ...(exQ > 0 ? { extraQuantity: exQ } : { extraByChampionship: extra }),
        ...(checkoutPromo ? { checkoutPromo } : {}),
      });
      return NextResponse.json({ transaction }, { status: 201 });
    }

    const parsed = createLegacySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos" }, { status: 400 });
    }

    const ticketType = parseTicketTypeOrThrow(parsed.data.ticketType);
    const quantity = parsed.data.quantity;
    if (ticketType === "extra") {
      const cid = parsed.data.extraChampionshipId;
      if (cid == null || !parseExtraBolaoChampionshipIds().includes(cid)) {
        return NextResponse.json({ error: "extraChampionshipId invalido para bolao extra" }, { status: 400 });
      }
      const transaction = await createDepositTransaction({
        userId,
        ticketType: "extra",
        quantity,
        extraChampionshipId: cid,
      });
      return NextResponse.json({ transaction }, { status: 201 });
    }

    const transaction = await createDepositTransaction({
      userId,
      ticketType,
      quantity,
    });
    return NextResponse.json({ transaction }, { status: 201 });
  } catch (e) {
    const db = responseForDbError(e);
    if (db) return NextResponse.json({ error: db.error }, { status: db.status });
    const message = e instanceof Error ? e.message : "Nao foi possivel criar a transacao";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
