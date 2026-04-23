export type StoredTicketGeral = {
  id: string;
  kind: "geral";
  createdAt: number;
};

export type StoredTicketDiario = {
  id: string;
  kind: "diario";
  createdAt: number;
  /** Formato DD/MM/AAAA — null até o usuário escolher o dia ao palpitar */
  playDate: string | null;
};

export type StoredTicket = StoredTicketGeral | StoredTicketDiario;

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
  return false;
}

export function loadOwnedTickets(): StoredTicket[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function saveOwnedTickets(tickets: StoredTicket[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`.toUpperCase();
}

/** Credita tickets na conta após pagamento (integração real viria do webhook). */
export function appendTicketsFromPurchase(principalCount: number, diarioCount: number) {
  const list = loadOwnedTickets();
  const now = Date.now();
  for (let i = 0; i < principalCount; i++) {
    list.push({ id: newId("TG"), kind: "geral", createdAt: now });
  }
  for (let i = 0; i < diarioCount; i++) {
    list.push({ id: newId("TD"), kind: "diario", createdAt: now, playDate: null });
  }
  saveOwnedTickets(list);
}

export function setDiarioTicketPlayDate(ticketId: string, playDateBR: string) {
  const list = loadOwnedTickets();
  const t = list.find((x) => x.id === ticketId && x.kind === "diario");
  if (t && t.kind === "diario") {
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
