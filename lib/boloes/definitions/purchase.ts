import type { MatchMap } from "@/lib/football-api";
import type { PurchaseTicketLine } from "@/lib/payments/ticket-config";
import { getSkaleDailyBolaoCompetitionId } from "@/lib/boloes/skale-daily-config";
import { isDailyEditionPurchaseOpen } from "@/lib/boloes/daily-editions-server";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { scopeMatchesForBolaoDefinition } from "@/lib/boloes/definitions/scope";
import type { BolaoDefinition } from "@/lib/boloes/definitions/types";

/** Converte definição admin → linha de compra (preço sempre do servidor). */
export function bolaoDefinitionToPurchaseLine(def: BolaoDefinition): PurchaseTicketLine {
  const line: PurchaseTicketLine = {
    ticketType: def.ticketType,
    unitCents: def.unitPriceCents,
    bolaoDefinitionId: def.id,
  };

  if (def.ticketType === "extra") {
    line.extraChampionshipId = def.competitionId;
    if (def.scopeMode === "daily_dates" && def.editionNumber != null) {
      line.dailyEditionNumber = def.editionNumber;
    } else if (def.scopeMode === "round" && def.roundNumber != null) {
      line.dailyEditionNumber = def.roundNumber;
    } else if (
      def.competitionId === getSkaleDailyBolaoCompetitionId() &&
      def.editionNumber != null
    ) {
      line.dailyEditionNumber = def.editionNumber;
    }
  }

  if (def.ticketType === "daily" && def.editionNumber != null) {
    line.dailyEditionNumber = def.editionNumber;
  }

  return line;
}

export function buildDefinitionPurchaseLines(
  definitionsById: Record<string, number>,
  definitions: BolaoDefinition[],
): PurchaseTicketLine[] {
  const byId = new Map(definitions.map((d) => [d.id, d]));
  const lines: PurchaseTicketLine[] = [];
  for (const [id, rawQty] of Object.entries(definitionsById)) {
    const def = byId.get(id);
    if (!def) throw new Error("Bolao selecionado nao encontrado");
    if (!def.enabled || !def.saleEnabled) {
      throw new Error(`${def.displayName} indisponivel para compra`);
    }
    const q = Math.max(0, Math.min(20, Math.trunc(rawQty)));
    for (let i = 0; i < q; i++) {
      lines.push(bolaoDefinitionToPurchaseLine(def));
    }
  }
  return lines;
}

/** Valida se o bolão admin ainda aceita compra (partidas em aberto no escopo). */
export function isBolaoDefinitionPurchaseOpen(
  def: BolaoDefinition,
  matchMap: MatchMap,
): boolean {
  if (!def.enabled || !def.saleEnabled) return false;
  const mainComp = getFootballMainCompetitionId();
  if (
    def.editionNumber != null &&
    (def.ticketType === "daily" ||
      (def.ticketType === "extra" && def.scopeMode === "daily_dates"))
  ) {
    return isDailyEditionPurchaseOpen(def.editionNumber, matchMap, mainComp);
  }
  const scoped = scopeMatchesForBolaoDefinition(def, matchMap);
  if (scoped.length === 0) return def.saleEnabled;
  const now = Date.now();
  return scoped.some((m) => {
    if (!m.dateBR) return true;
    const [d, mo, y] = m.dateBR.split("/").map(Number);
    if (!Number.isFinite(d) || !Number.isFinite(mo) || !Number.isFinite(y)) return true;
    const [hh, mm] = String(m.hour || "23:59").split(":").map(Number);
    const kickoff = Date.UTC(y, mo - 1, d, (hh || 0) + 3, mm || 0, 0);
    return kickoff > now;
  });
}

export function normalizeDefinitionsByIdInput(
  raw: Record<string, number> | Record<number, number> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    const id = String(k).trim();
    if (!id) continue;
    const q = Math.max(0, Math.min(20, Math.trunc(Number(v) || 0)));
    if (q > 0) out[id] = q;
  }
  return out;
}
