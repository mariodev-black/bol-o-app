import type { AdminBolaoHubItem } from "@/lib/boloes/definitions/types";
import {
  ACTIVE_BOLAO_STATUSES,
  CLOSED_BOLAO_STATUSES,
  isScheduledBolaoStatus,
} from "@/lib/boloes/definitions/lifecycle-labels";

export type AdminBolaoHubFilter =
  | "all"
  | "active"
  | "open"
  | "scheduled"
  | "closed"
  | "inactive";

export const ADMIN_BOLAO_HUB_FILTERS: { id: AdminBolaoHubFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Em andamento" },
  { id: "open", label: "Abertos" },
  { id: "scheduled", label: "Programados" },
  { id: "closed", label: "Encerrados" },
  { id: "inactive", label: "Inativos" },
];

export function resolveAdminBolaoStatus(item: AdminBolaoHubItem) {
  return item.computedStatus;
}

export function matchesAdminBolaoFilter(
  item: AdminBolaoHubItem,
  filter: AdminBolaoHubFilter,
): boolean {
  if (filter === "inactive") return !item.enabled;

  const status = item.computedStatus;

  switch (filter) {
    case "all":
      return true;
    case "active":
      return ACTIVE_BOLAO_STATUSES.has(status);
    case "open":
      return (
        item.enabled &&
        item.saleEnabled &&
        !CLOSED_BOLAO_STATUSES.has(status) &&
        (status === "aberto" || isScheduledBolaoStatus(status))
      );
    case "scheduled":
      return isScheduledBolaoStatus(status);
    case "closed":
      return CLOSED_BOLAO_STATUSES.has(status);
    default:
      return true;
  }
}

export function countByAdminBolaoFilter(
  items: AdminBolaoHubItem[],
  filter: AdminBolaoHubFilter,
): number {
  return items.filter((item) => matchesAdminBolaoFilter(item, filter)).length;
}

export function bolaoMatchesSearch(item: AdminBolaoHubItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.displayName.toLowerCase().includes(q) ||
    item.slug.toLowerCase().includes(q) ||
    (item.subtitle?.toLowerCase().includes(q) ?? false) ||
    item.competitionDisplayName.toLowerCase().includes(q)
  );
}

export {
  adminBolaoStatusLabel,
  ADMIN_BOLAO_STATUS_STYLES,
} from "@/lib/boloes/definitions/lifecycle-labels";
