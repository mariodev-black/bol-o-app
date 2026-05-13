export type StoredTicketGeral = {
  id: string;
  kind: "geral";
  createdAt: number;
  availableGames?: number;
};

export type StoredTicketDiario = {
  id: string;
  kind: "diario";
  createdAt: number;
  /** Formato DD/MM/AAAA — null até o usuário escolher o dia ao palpitar */
  playDate: string | null;
  dailyStatus?: "disponivel" | "em_uso" | "usado";
  availableGames?: number;
};

export type StoredTicketExtra = {
  id: string;
  kind: "extra";
  createdAt: number;
  championshipId: number;
  playDate: string | null;
  dailyStatus?: "disponivel" | "em_uso" | "usado";
  availableGames?: number;
};

export type StoredTicket = StoredTicketGeral | StoredTicketDiario | StoredTicketExtra;

const STORAGE_KEY = "bolao_owned_tickets_v1";

function safeParse(raw: string | null): StoredTicket[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(isStoredTicket).map((t) => {
      if (t.kind === "diario" && (t.playDate === undefined || t.playDate === "")) {
        return { ...t, playDate: null } as StoredTicketDiario;
      }
      return t as StoredTicket;
    });
  } catch {
    return [];
  }
}

function isStoredTicket(x: unknown): x is StoredTicket {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.kind !== "string") return false;
  if (o.kind === "geral") return typeof o.createdAt === "number";
    if (o.kind === "diario") {
      return (
        typeof o.createdAt === "number" &&
        (o.playDate === null || o.playDate === undefined || typeof o.playDate === "string")
      );
    }
    if (o.kind === "extra") {
      return (
        typeof o.createdAt === "number" &&
        typeof o.championshipId === "number" &&
        (o.playDate === null || o.playDate === undefined || typeof o.playDate === "string")
      );
    }
  return false;
}

export function loadOwnedTickets(): StoredTicket[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

/** IDs de tickets persistidos no Postgres (UUID v4). */
export function isLikelyDbTicketId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

type MineTicketDto = {
  id: string;
  ticketType: "general" | "daily" | "extra";
  quantity: number;
  paidAt: string | null;
  createdAt: string;
  dailyStatus?: "disponivel" | "em_uso" | "usado";
  playDate?: string | null;
  availableGames?: number;
  extraChampionshipId?: number | null;
};

function mapMineDtoToStored(row: MineTicketDto): StoredTicket {
  const createdAt = row.paidAt ? new Date(row.paidAt).getTime() : new Date(row.createdAt).getTime();
  if (row.ticketType === "daily") {
    return {
      id: row.id,
      kind: "diario",
      createdAt,
      playDate: row.playDate ?? null,
      dailyStatus: row.dailyStatus ?? "disponivel",
      availableGames: Math.max(0, Number(row.availableGames ?? 0)),
    };
  }
  if (row.ticketType === "extra") {
    return {
      id: row.id,
      kind: "extra",
      createdAt,
      championshipId: row.extraChampionshipId ?? 0,
      playDate: row.playDate ?? null,
      dailyStatus: row.dailyStatus ?? "disponivel",
      availableGames: Math.max(0, Number(row.availableGames ?? 0)),
    };
  }
  return { id: row.id, kind: "geral", createdAt, availableGames: Math.max(0, Number(row.availableGames ?? 0)) };
}

/**
 * Tickets pagos no banco + legado local (TG-/TD-).
 * Se existir qualquer ticket pago no servidor, ele tem prioridade e só entram no merge
 * entradas locais que não são UUID (evita duplicar após fluxo PIX + localStorage).
 */
export async function loadOwnedTicketsMerged(): Promise<StoredTicket[]> {
  const local = loadOwnedTickets();
  try {
    const r = await fetch("/api/tickets/mine", { credentials: "include", cache: "no-store" });
    if (!r.ok) return local;
    const data = (await r.json()) as { tickets?: MineTicketDto[] };
    const rows = Array.isArray(data.tickets) ? data.tickets : [];
    const fromDb = rows.map(mapMineDtoToStored);
    if (fromDb.length === 0) return local;
    const localLegacy = local.filter((t) => !isLikelyDbTicketId(t.id));
    return [...fromDb, ...localLegacy];
  } catch {
    return local;
  }
}

export function saveOwnedTickets(tickets: StoredTicket[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`.toUpperCase();
}

/** Credita tickets na conta após pagamento (integração real viria do webhook). */
export function appendTicketsFromPurchase(
  principalCount: number,
  diarioCount: number,
  extraByChampionship?: Record<number, number>,
) {
  const list = loadOwnedTickets();
  const now = Date.now();
  for (let i = 0; i < principalCount; i++) {
    list.push({ id: newId("TG"), kind: "geral", createdAt: now });
  }
  for (let i = 0; i < diarioCount; i++) {
    list.push({ id: newId("TD"), kind: "diario", createdAt: now, playDate: null });
  }
  if (extraByChampionship) {
    for (const [cid, qty] of Object.entries(extraByChampionship)) {
      const championshipId = Number.parseInt(cid, 10);
      if (!Number.isFinite(championshipId) || championshipId <= 0 || qty <= 0) continue;
      for (let i = 0; i < qty; i++) {
        list.push({
          id: newId("TE"),
          kind: "extra",
          createdAt: now,
          championshipId,
          playDate: null,
        });
      }
    }
  }
  saveOwnedTickets(list);
}

export function setDiarioTicketPlayDate(ticketId: string, playDateBR: string) {
  const list = loadOwnedTickets();
  const t = list.find((x) => x.id === ticketId && (x.kind === "diario" || x.kind === "extra"));
  if (t && (t.kind === "diario" || t.kind === "extra")) {
    t.playDate = playDateBR;
    saveOwnedTickets(list);
  }
}

/** ISO yyyy-mm-dd → DD/MM/AAAA */
export function isoDateToBR(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

export function palpitesUrlPrincipal(ticketId: string) {
  const q = new URLSearchParams({ ticket: ticketId });
  return `/palpites?${q.toString()}`;
}

export function palpitesUrlDiario(ticketId: string) {
  const q = new URLSearchParams({ ticket: ticketId });
  return `/palpites?${q.toString()}`;
}
