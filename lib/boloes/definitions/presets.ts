import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import {
  getSkaleBolaoCompetitionId,
  getSkaleBolaoUnitCents,
} from "@/lib/boloes/skale-config";
import {
  getSkaleDailyBolaoCompetitionId,
  getSkaleDailyBolaoUnitCents,
} from "@/lib/boloes/skale-daily-config";
import {
  getWeekendBolaoUnitCents,
  isWeekendBolaoCompetition,
} from "@/lib/boloes/weekend-bolao-config";
import type {
  AdminCompetitionOption,
  BolaoDefinitionTicketType,
  BolaoScopeMode,
} from "@/lib/boloes/definitions/types";
import {
  getExtraBolaoUnitCentsForChampionship,
  getTicketPriceCents,
} from "@/lib/payments/ticket-config";

export const SCOPE_MODE_LABELS: Record<BolaoScopeMode, string> = {
  full_competition: "Campeonato inteiro",
  daily_dates: "Dias selecionados",
  round: "Por rodada",
  weekend: "Fim de semana",
};

/** Modalidade disponível após escolher o campeonato. */
export type BolaoKindPreset = {
  id: string;
  label: string;
  description: string;
  ticketType: BolaoDefinitionTicketType;
  defaultPriceCents: number;
  /** Escopos que o admin pode escolher no passo de configuração */
  allowedScopeModes: BolaoScopeMode[];
  /** Exibe campo de número da edição (bolões diários) */
  showEditionNumber: boolean;
  suggestedName: string;
  suggestedSubtitle: string | null;
};

export function getAllowedScopeModes(
  ticketType: BolaoDefinitionTicketType,
  competitionId: number,
): BolaoScopeMode[] {
  const mainComp = getFootballMainCompetitionId();
  if (ticketType === "general") return ["full_competition"];
  if (ticketType === "daily") return ["daily_dates", "round"];
  if (isWeekendBolaoCompetition(competitionId)) return ["weekend", "daily_dates", "round"];
  if (competitionId === getSkaleBolaoCompetitionId()) {
    return ["full_competition", "daily_dates"];
  }
  if (competitionId === getSkaleDailyBolaoCompetitionId()) {
    return ["daily_dates"];
  }
  if (competitionId === mainComp) return ["daily_dates", "round"];
  return ["round", "daily_dates", "full_competition"];
}

export function getBolaoKindPresets(competition: AdminCompetitionOption): BolaoKindPreset[] {
  const mainComp = getFootballMainCompetitionId();
  const skaleId = getSkaleBolaoCompetitionId();
  const skaleDailyId = getSkaleDailyBolaoCompetitionId();
  const compName = competition.displayName;

  if (competition.id === mainComp) {
    return [
      {
        id: "copa-principal",
        label: "Bolão Principal",
        description: "Ranking geral — todas as partidas da Copa.",
        ticketType: "general",
        defaultPriceCents: getTicketPriceCents("general"),
        allowedScopeModes: ["full_competition"],
        showEditionNumber: false,
        suggestedName: "Bolão do Milhão",
        suggestedSubtitle: `${compName} — campeonato completo`,
      },
      {
        id: "copa-diario",
        label: "Bolão Diário",
        description: "Por dias ou por rodada — você escolhe o escopo.",
        ticketType: "daily",
        defaultPriceCents: getTicketPriceCents("daily"),
        allowedScopeModes: ["daily_dates", "round"],
        showEditionNumber: true,
        suggestedName: "Bolão Diário",
        suggestedSubtitle: `${compName} — edição diária`,
      },
    ];
  }

  if (competition.id === skaleDailyId) {
    return [
      {
        id: "skale-diario",
        label: "Bolão Diário Skale",
        description: "Selecione os dias da edição Skale.",
        ticketType: "extra",
        defaultPriceCents: getSkaleDailyBolaoUnitCents(),
        allowedScopeModes: ["daily_dates"],
        showEditionNumber: true,
        suggestedName: "Bolão Diário Skale",
        suggestedSubtitle: "Copa 2026 — edições diárias Skale",
      },
    ];
  }

  if (competition.id === skaleId) {
    return [
      {
        id: "skale-integral",
        label: "Bolão Skale Integral",
        description: "Campeonato inteiro ou dias específicos.",
        ticketType: "extra",
        defaultPriceCents: getSkaleBolaoUnitCents(),
        allowedScopeModes: ["full_competition", "daily_dates"],
        showEditionNumber: false,
        suggestedName: "Bolão Skale",
        suggestedSubtitle: "Copa do Mundo — pool exclusivo Skale",
      },
    ];
  }

  if (isWeekendBolaoCompetition(competition.id)) {
    return [
      {
        id: "weekend",
        label: "Bolão Fim de Semana",
        description: "Fim de semana, rodada ou dias à sua escolha.",
        ticketType: "extra",
        defaultPriceCents: getWeekendBolaoUnitCents(),
        allowedScopeModes: ["weekend", "round", "daily_dates"],
        showEditionNumber: false,
        suggestedName: `Bolão FDS — ${compName}`,
        suggestedSubtitle: "Jogos do fim de semana",
      },
    ];
  }

  return [
    {
      id: "extra-custom",
      label: "Bolão Extra",
      description: "Por rodada, por dias ou campeonato inteiro.",
      ticketType: "extra",
      defaultPriceCents: getExtraBolaoUnitCentsForChampionship(competition.id),
      allowedScopeModes: ["round", "daily_dates", "full_competition"],
      showEditionNumber: false,
      suggestedName: `Bolão ${compName}`,
      suggestedSubtitle: competition.currentRoundLabel ?? compName,
    },
  ];
}

export function findKindPreset(
  competition: AdminCompetitionOption,
  kindId: string,
): BolaoKindPreset | null {
  return getBolaoKindPresets(competition).find((k) => k.id === kindId) ?? null;
}

export function ticketTypeLabel(type: BolaoDefinitionTicketType): string {
  if (type === "general") return "Principal";
  if (type === "daily") return "Diário";
  return "Extra";
}
