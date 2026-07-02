import type { BolaoLifecycleStatus } from "@/lib/boloes/definitions/types";

export const LIFECYCLE_STATUS_LABELS: Record<BolaoLifecycleStatus, string> = {
  programado: "Programado",
  aberto: "Aberto",
  ao_vivo: "Ao vivo",
  encerrado: "Encerrado",
  finalizado: "Finalizado",
  premiacao_liberada: "Premiação liberada",
};

export const CLOSED_BOLAO_STATUSES = new Set<BolaoLifecycleStatus>([
  "encerrado",
  "finalizado",
  "premiacao_liberada",
]);

export const ACTIVE_BOLAO_STATUSES = new Set<BolaoLifecycleStatus>([
  "aberto",
  "ao_vivo",
]);

export function isClosedBolaoStatus(status: BolaoLifecycleStatus): boolean {
  return CLOSED_BOLAO_STATUSES.has(status);
}

export function isActiveBolaoStatus(status: BolaoLifecycleStatus): boolean {
  return ACTIVE_BOLAO_STATUSES.has(status);
}

export function isScheduledBolaoStatus(status: BolaoLifecycleStatus): boolean {
  return status === "programado";
}

/** Status exibidos no admin — oculta estados internos redundantes. */
export function adminBolaoStatusLabel(status: BolaoLifecycleStatus): string {
  if (status === "finalizado" || status === "premiacao_liberada") {
    return "Encerrado";
  }
  return LIFECYCLE_STATUS_LABELS[status];
}

export const ADMIN_BOLAO_STATUS_STYLES: Record<BolaoLifecycleStatus, string> = {
  programado: "bg-sky-500/12 text-sky-300 border-sky-400/25",
  aberto: "bg-primary/14 text-primary border-primary/30",
  ao_vivo: "bg-red-500/14 text-red-300 border-red-400/30",
  encerrado: "bg-white/6 text-white/45 border-white/10",
  finalizado: "bg-white/6 text-white/45 border-white/10",
  premiacao_liberada: "bg-amber-400/14 text-amber-200 border-amber-400/28",
};
