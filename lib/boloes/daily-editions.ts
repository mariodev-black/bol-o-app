/**
 * Bolões diários da Fase de Grupos — edições numeradas que englobam intervalos de datas.
 * `tickets.round_number` guarda o número da edição (1–11) em cotas `daily`.
 */

import { utcMsForBrDate } from "@/lib/diario-playable-date";
import { getMatchFromMap, type MatchMap, type MatchMapEntry } from "@/lib/football-api";
import { hasOfficialMatchResult } from "@/lib/palpites-match-open";
import { palpiteLockBeforeKickoffMs } from "@/lib/palpites-kickoff-lock";

export type DailyEditionPhase = "grupos";

export type DailyEdition = {
  number: number;
  phase: DailyEditionPhase;
  /** Datas dd/MM/yyyy (America/Sao_Paulo) cobertas por esta edição. */
  datesBR: string[];
};

const MONTH_NAMES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Fase de Grupos — Copa do Mundo 2026 (junho). */
export const GROUP_STAGE_DAILY_EDITIONS: DailyEdition[] = [
  { number: 1, phase: "grupos", datesBR: ["11/06/2026", "12/06/2026", "13/06/2026"] },
  { number: 2, phase: "grupos", datesBR: ["14/06/2026"] },
  { number: 3, phase: "grupos", datesBR: ["15/06/2026", "16/06/2026"] },
  { number: 4, phase: "grupos", datesBR: ["17/06/2026", "18/06/2026"] },
  { number: 5, phase: "grupos", datesBR: ["19/06/2026", "20/06/2026"] },
  { number: 6, phase: "grupos", datesBR: ["21/06/2026", "22/06/2026"] },
  { number: 7, phase: "grupos", datesBR: ["23/06/2026"] },
  { number: 8, phase: "grupos", datesBR: ["24/06/2026"] },
  { number: 9, phase: "grupos", datesBR: ["25/06/2026"] },
  { number: 10, phase: "grupos", datesBR: ["26/06/2026"] },
  { number: 11, phase: "grupos", datesBR: ["27/06/2026"] },
];

const EDITION_BY_NUMBER = new Map(
  GROUP_STAGE_DAILY_EDITIONS.map((e) => [e.number, e] as const),
);

const EDITION_BY_DATE = new Map<string, DailyEdition>();
for (const edition of GROUP_STAGE_DAILY_EDITIONS) {
  for (const d of edition.datesBR) {
    EDITION_BY_DATE.set(d.trim(), edition);
  }
}

export function isValidDailyEditionNumber(n: unknown): n is number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 1 && v <= GROUP_STAGE_DAILY_EDITIONS.length;
}

export function getDailyEdition(number: number): DailyEdition | null {
  return EDITION_BY_NUMBER.get(number) ?? null;
}

export function listGroupStageDailyEditions(): DailyEdition[] {
  return GROUP_STAGE_DAILY_EDITIONS;
}

export function dailyEditionLabel(number: number): string {
  return `Bolão Diário #${number}`;
}

export function getDailyEditionForDate(dateBR: string): DailyEdition | null {
  const d = dateBR.trim();
  if (!d) return null;
  return EDITION_BY_DATE.get(d) ?? null;
}

export function isDateInDailyEdition(dateBR: string, editionNumber: number): boolean {
  const edition = getDailyEdition(editionNumber);
  if (!edition) return false;
  return edition.datesBR.includes(dateBR.trim());
}

export function getDailyEditionDatesSet(editionNumber: number): ReadonlySet<string> {
  const edition = getDailyEdition(editionNumber);
  if (!edition) return new Set();
  return new Set(edition.datesBR);
}

function dayMonthLabel(dateBR: string): string | null {
  const [d, m] = dateBR.split("/");
  if (!d || !m) return null;
  const day = Number(d);
  const month = Number(m);
  if (!Number.isFinite(day) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return `${day} de ${MONTH_NAMES_PT[month - 1]}`;
}

/** Ex.: "11, 12 e 13 de junho" ou "14 de junho". */
export function formatDailyEditionDatesLabel(edition: DailyEdition): string {
  const parts = edition.datesBR
    .map((d) => {
      const [dd, mm] = d.split("/");
      if (!dd || !mm) return null;
      const day = Number(dd);
      const month = Number(mm);
      if (!Number.isFinite(day) || !Number.isFinite(month) || month < 1 || month > 12) {
        return null;
      }
      return { day, month, monthName: MONTH_NAMES_PT[month - 1]! };
    })
    .filter((x) => x != null);

  if (parts.length === 0) return "";
  const monthName = parts[0]!.monthName;
  const days = parts.map((p) => p.day);
  if (days.length === 1) return `${days[0]} de ${monthName}`;
  if (days.length === 2) return `${days[0]} e ${days[1]} de ${monthName}`;
  const last = days[days.length - 1]!;
  const head = days.slice(0, -1).join(", ");
  return `${head} e ${last} de ${monthName}`;
}

/** Ex.: "dias: 11, 12 e 13 de junho" ou "dia: 14 de junho". */
export function formatDailyEditionDatesSubtitle(edition: DailyEdition): string {
  const dates = formatDailyEditionDatesLabel(edition);
  if (!dates) return "";
  const prefix = edition.datesBR.length === 1 ? "dia:" : "dias:";
  return `${prefix} ${dates}`;
}

export type DailyEditionStatus = "aberto" | "encerrado" | "em_breve";

function isMatchFinishedForEdition(m: Pick<MatchMapEntry, "status" | "kickoffAt" | "resultCasa" | "resultVisitante">): boolean {
  const st = String(m.status || "").toLowerCase();
  if (
    st.includes("encerr") ||
    st.includes("finaliz") ||
    st.includes("cancel") ||
    st.includes("adiad") ||
    st.includes("suspens") ||
    st.includes("interromp")
  ) {
    return true;
  }
  return hasOfficialMatchResult({
    status: m.status,
    kickoffAt: m.kickoffAt,
    resultCasa: m.resultCasa,
    resultVisitante: m.resultVisitante,
  });
}

function matchesForEdition(
  edition: DailyEdition,
  matchMap: MatchMap,
  mainComp: number,
): MatchMapEntry[] {
  const dateSet = new Set(edition.datesBR);
  const out: MatchMapEntry[] = [];
  for (const m of matchMap.values()) {
    if ((Number(m.competitionId) || mainComp) !== mainComp) continue;
    if (m.dateBR && dateSet.has(m.dateBR)) out.push(m);
  }
  return out;
}

/** Edição encerrada: todos os jogos do intervalo já passaram do prazo de palpite. */
export function isDailyEditionClosed(
  editionNumber: number,
  matchMap: MatchMap,
  mainComp: number,
  nowMs: number = Date.now(),
): boolean {
  const edition = getDailyEdition(editionNumber);
  if (!edition) return true;
  const lockLead = palpiteLockBeforeKickoffMs("diario");
  const scoped = matchesForEdition(edition, matchMap, mainComp);

  if (scoped.length === 0) {
    const lastDate = edition.datesBR[edition.datesBR.length - 1]!;
    const lastMs = utcMsForBrDate(lastDate);
    if (lastMs == null) return false;
    const endOfDayMs = lastMs + 24 * 60 * 60 * 1000;
    return nowMs >= endOfDayMs;
  }

  let hasOpen = false;
  for (const m of scoped) {
    if (isMatchFinishedForEdition(m)) continue;
    const ko = m.kickoffAt ? new Date(m.kickoffAt).getTime() : null;
    const locked = ko != null && Number.isFinite(ko) && nowMs >= ko - lockLead;
    if (!locked) {
      hasOpen = true;
      break;
    }
  }
  return !hasOpen;
}

export function resolveDailyEditionStatus(
  editionNumber: number,
  matchMap: MatchMap,
  mainComp: number,
  nowMs: number = Date.now(),
): DailyEditionStatus {
  const edition = getDailyEdition(editionNumber);
  if (!edition) return "encerrado";

  if (isDailyEditionClosed(editionNumber, matchMap, mainComp, nowMs)) {
    return "encerrado";
  }

  const firstDate = edition.datesBR[0]!;
  const firstMs = utcMsForBrDate(firstDate);
  const todayMs = utcMsForBrDate(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(nowMs)),
  );
  if (firstMs != null && todayMs != null && todayMs < firstMs) {
    return "em_breve";
  }

  return "aberto";
}

export function isDailyEditionPurchaseOpen(
  editionNumber: number,
  matchMap: MatchMap,
  mainComp: number,
  nowMs?: number,
): boolean {
  return !isDailyEditionClosed(editionNumber, matchMap, mainComp, nowMs);
}

/** Número da edição gravado em `tickets.round_number` (1–11). */
export function paidTicketDailyEditionNumber(ticket: {
  ticketType?: string;
  round_number?: number | null;
  dailyEditionNumber?: number | null;
}): number | null {
  const raw =
    ticket.dailyEditionNumber != null
      ? ticket.dailyEditionNumber
      : ticket.ticketType === "daily"
        ? ticket.round_number
        : null;
  const n = Number(raw);
  return isValidDailyEditionNumber(n) ? n : null;
}

/** Infere edição a partir das datas dos palpites (legado sem `round_number`). */
export function inferDailyEditionFromDates(dates: Iterable<string>): number | null {
  let inferred: number | null = null;
  for (const raw of dates) {
    const edition = getDailyEditionForDate(raw.trim());
    if (!edition) return null;
    if (inferred == null) inferred = edition.number;
    else if (inferred !== edition.number) return null;
  }
  return inferred;
}

export function inferDailyEditionFromMatchIds(
  matchIds: Iterable<number>,
  matchMap: MatchMap,
  mainComp: number,
): number | null {
  const dates: string[] = [];
  for (const rawId of matchIds) {
    const m = getMatchFromMap(matchMap, mainComp, Number(rawId));
    if (m?.dateBR) dates.push(m.dateBR);
  }
  return inferDailyEditionFromDates(dates);
}

export function normalizeDailyByEditionInput(
  raw: Record<string, number> | Record<number, number> | undefined,
): Record<number, number> {
  const out: Record<number, number> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    const edition = Number.parseInt(k, 10);
    if (!isValidDailyEditionNumber(edition)) continue;
    const q = Math.max(0, Math.min(5, Math.trunc(Number(v) || 0)));
    if (q > 0) out[edition] = q;
  }
  return out;
}

export function dailyEditionClosureKey(competitionId: number, editionNumber: number): string {
  return `${competitionId}:daily:edition:${editionNumber}`;
}

export type DailyEditionShopItem = {
  number: number;
  label: string;
  datesLabel: string;
  datesBR: string[];
  status: DailyEditionStatus;
  purchaseOpen: boolean;
};

/**
 * Edição exibida na loja: a mais próxima no calendário que ainda aceita compra.
 * Percorre #1 → #11 e retorna a primeira não encerrada.
 */
export function resolveShopDailyEdition(
  items: DailyEditionShopItem[],
): DailyEditionShopItem | null {
  const sorted = [...items].sort((a, b) => a.number - b.number);
  return sorted.find((e) => e.purchaseOpen) ?? null;
}
