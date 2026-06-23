import { resolveExtraBolaoDisplayName } from "@/lib/boloes-extra-competition-branding";
import { isSkaleBolaoCompetition, SKALE_BOLAO_DISPLAY_NAME } from "@/lib/boloes/skale-config";
import {
  isSkaleDailyBolaoCompetition,
  SKALE_DAILY_BOLAO_DISPLAY_NAME,
} from "@/lib/boloes/skale-daily-config";
import { isWeekendBolaoCompetition, WEEKEND_BOLAO_DISPLAY_NAME } from "@/lib/boloes/weekend-bolao-config";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatAdminBRL(cents: number): string {
  return brl.format(cents / 100);
}

export function formatAdminBRLNullable(cents: number | null | undefined): string {
  if (cents == null) return "Não informado";
  return formatAdminBRL(cents);
}

export function formatAdminDate(value: string | Date | null | undefined): string {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export function formatAdminDateTime(value: string | Date | null | undefined): string {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function maskAdminCpf(cpf: string | null | undefined): string {
  const digits = (cpf ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return cpf?.trim() || "Não informado";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatAdminTicketType(type: string | null | undefined) {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized === "general") return "Principal";
  if (normalized === "daily") return "Diário";
  if (normalized === "extra") return "Extra";
  if (normalized === "artilheiros") return "Artilheiros";
  return type || "Não informado";
}

export type AdminTicketLabelInput = {
  ticketType: string | null | undefined;
  extraChampionshipId?: number | null;
  roundNumber?: number | null;
  bolaoDefinitionName?: string | null;
  competitionCachedName?: string | null;
};

/** Nome amigável da cota para listagens no admin (ex.: Bolão Skale, Brasileirão). */
export function formatAdminTicketLabel(input: AdminTicketLabelInput): string {
  const definitionName = input.bolaoDefinitionName?.trim();
  if (definitionName) return definitionName;

  const type = String(input.ticketType ?? "").toLowerCase();
  if (type === "general") return "Bolão Principal";
  if (type === "daily") return "Bolão Diário";
  if (type === "artilheiros") return "Bolão Artilheiros";

  if (type === "extra") {
    const championshipId = input.extraChampionshipId;
    if (championshipId != null && isSkaleBolaoCompetition(championshipId) && !isSkaleDailyBolaoCompetition(championshipId)) {
      return SKALE_BOLAO_DISPLAY_NAME;
    }
    if (championshipId != null && isSkaleDailyBolaoCompetition(championshipId)) {
      const edition = input.roundNumber;
      if (edition != null && edition > 0) {
        return `${SKALE_DAILY_BOLAO_DISPLAY_NAME} #${edition}`;
      }
      return SKALE_DAILY_BOLAO_DISPLAY_NAME;
    }
    if (championshipId != null && isWeekendBolaoCompetition(championshipId)) {
      return WEEKEND_BOLAO_DISPLAY_NAME;
    }
    if (championshipId != null) {
      const base = resolveExtraBolaoDisplayName(championshipId, input.competitionCachedName);
      const round = input.roundNumber;
      if (round != null && round > 0) {
        return `${base} · ${formatAdminRodadaLabel(round)}`;
      }
      return base;
    }
    return "Bolão Extra";
  }

  return formatAdminTicketType(type);
}

export function formatAdminTicketShortId(ticketId: string): string {
  const id = ticketId.trim();
  if (!id) return "—";
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/** Rótulo de rodada para admin (ex.: 17ª Rodada). */
export function formatAdminRodadaLabel(rodada: number): string {
  const n = Math.round(rodada);
  if (!Number.isFinite(n) || n < 1) return "Rodada";
  return `${n}ª Rodada`;
}

export function formatAdminCpaBps(cpaBps: number | null | undefined): string {
  return `${((cpaBps ?? 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}
