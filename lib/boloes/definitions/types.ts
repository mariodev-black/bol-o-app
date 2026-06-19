export type BolaoScopeMode =
  | "full_competition"
  | "daily_dates"
  | "round"
  | "weekend";

export type BolaoDefinitionTicketType = "general" | "daily" | "extra";

export type BolaoPrizeTier = {
  rank: number;
  poolBps: number;
};

export type BolaoDefinition = {
  id: string;
  slug: string;
  displayName: string;
  subtitle: string | null;
  ticketType: BolaoDefinitionTicketType;
  competitionId: number;
  scopeMode: BolaoScopeMode;
  scopeDates: string[];
  roundNumber: number | null;
  editionNumber: number | null;
  unitPriceCents: number;
  saleEnabled: boolean;
  shopVisible: boolean;
  sortOrder: number;
  logoUrl: string | null;
  logoVariant: string | null;
  useCompetitionLogo: boolean;
  prizePoolBps: number;
  prizeTiers: BolaoPrizeTier[];
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BolaoDefinitionInput = {
  slug?: string;
  displayName: string;
  subtitle?: string | null;
  ticketType: BolaoDefinitionTicketType;
  competitionId: number;
  scopeMode: BolaoScopeMode;
  scopeDates?: string[];
  roundNumber?: number | null;
  editionNumber?: number | null;
  unitPriceCents: number;
  saleEnabled?: boolean;
  shopVisible?: boolean;
  sortOrder?: number;
  logoUrl?: string | null;
  logoVariant?: string | null;
  useCompetitionLogo?: boolean;
  prizePoolBps?: number;
  prizeTiers?: BolaoPrizeTier[];
  metadata?: Record<string, unknown>;
  enabled?: boolean;
};

export type AdminCompetitionOption = {
  id: number;
  displayName: string;
  logoUrl: string | null;
  iconVariant: string;
  currentRound: number | null;
  currentRoundLabel: string | null;
  isSynthetic: boolean;
};

export type BolaoDefinitionCatalogItem = BolaoDefinition & {
  competitionDisplayName: string;
  resolvedLogoUrl: string | null;
  resolvedIconVariant: string;
  datesLabel: string | null;
  priceLabel: string;
};

export type BolaoDefinitionStats = {
  ticketsPaid: number;
  ticketsPending: number;
  revenueCents: number;
  participants: number;
  predictionsCount: number;
};

export type BolaoDefinitionWithStats = BolaoDefinition & BolaoDefinitionStats;
