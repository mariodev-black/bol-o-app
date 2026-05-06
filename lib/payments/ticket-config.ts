export type TicketType = "general" | "daily";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function parsePositiveInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export function getTicketPriceCents(type: TicketType): number {
  if (type === "daily") {
    return parsePositiveInt(env("TICKET_PRICE_DAILY_CENTS"), 2000);
  }
  return parsePositiveInt(env("TICKET_PRICE_GENERAL_CENTS"), 4990);
}

export function getExtraTicketPriceCents(): number {
  return parsePositiveInt(env("TICKET_PRICE_EXTRA_CENTS"), 3990);
}

export function ticketTypeLabel(type: TicketType): string {
  return type === "daily" ? "Ticket Diario" : "Ticket Geral";
}

export function parseTicketType(input: unknown): TicketType | null {
  if (input === "general" || input === "daily") return input;
  return null;
}
