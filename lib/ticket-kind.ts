/**
 * Helpers de ticket **sem Node/`pg`** — podem ir para Client Components.
 * Inferência completa (UUID no banco): `lib/ticket-kind-server` ou `GET /api/tickets/bolao-type`.
 */
export { normalizeTicketIdForDbLookup, inferBolaoTypeFromTicketPrefix } from "./ticket-kind-shared";
