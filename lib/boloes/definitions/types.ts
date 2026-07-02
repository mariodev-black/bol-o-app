export type BolaoScopeMode =
  | "full_competition"
  | "daily_dates"
  | "round"
  | "weekend"
  | "custom_matches"
  | "multi_competition";

export type BolaoDefinitionTicketType = "general" | "daily" | "extra";

export type BolaoLifecycleStatus =
  | "programado"
  | "aberto"
  | "ao_vivo"
  | "encerrado"
  | "finalizado"
  | "premiacao_liberada";

export type BolaoPrizeTier = {
  rank: number;
  /** % do pool de premiação (usado quando amountCents não está definido). */
  poolBps: number;
  /** Prêmio fixo em centavos — somado ao pool dinâmico quando definido. */
  amountCents?: number;
};

/** Regra de escopo por campeonato (bolões multi-competição). */
export type BolaoCompetitionScopeRule = {
  competitionId: number;
  mode: BolaoScopeMode | "all_matches";
  scopeDates?: string[];
  roundNumber?: number | null;
  matchIds?: number[];
};

export type BolaoScopeConfig = {
  competitions: BolaoCompetitionScopeRule[];
};

export type BolaoScoringConfig = {
  /** Ex.: copa_default, daily_top10, custom */
  system?: string;
  exactScorePoints?: number;
  outcomePoints?: number;
  goalDiffPoints?: number;
};

export type BolaoDefinition = {
  id: string;
  slug: string;
  displayName: string;
  subtitle: string | null;
  description: string | null;
  ticketType: BolaoDefinitionTicketType;
  competitionId: number;
  competitionIds: number[];
  scopeMode: BolaoScopeMode;
  scopeDates: string[];
  scopeMatchIds: number[];
  scopeConfig: BolaoScopeConfig;
  roundNumber: number | null;
  editionNumber: number | null;
  unitPriceCents: number;
  saleEnabled: boolean;
  shopVisible: boolean;
  sortOrder: number;
  logoUrl: string | null;
  bannerUrl: string | null;
  logoVariant: string | null;
  useCompetitionLogo: boolean;
  prizePoolBps: number;
  prizeTiers: BolaoPrizeTier[];
  scoringConfig: BolaoScoringConfig;
  startsAt: string | null;
  endsAt: string | null;
  settlementAt: string | null;
  prizeReleaseAt: string | null;
  maxTicketsPerUser: number | null;
  lifecycleStatus: BolaoLifecycleStatus;
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BolaoDefinitionInput = {
  slug?: string;
  displayName: string;
  subtitle?: string | null;
  description?: string | null;
  ticketType: BolaoDefinitionTicketType;
  competitionId: number;
  competitionIds?: number[];
  scopeMode: BolaoScopeMode;
  scopeDates?: string[];
  scopeMatchIds?: number[];
  scopeConfig?: BolaoScopeConfig;
  roundNumber?: number | null;
  editionNumber?: number | null;
  unitPriceCents: number;
  saleEnabled?: boolean;
  shopVisible?: boolean;
  sortOrder?: number;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  logoVariant?: string | null;
  useCompetitionLogo?: boolean;
  prizePoolBps?: number;
  prizeTiers?: BolaoPrizeTier[];
  scoringConfig?: BolaoScoringConfig;
  startsAt?: string | null;
  endsAt?: string | null;
  settlementAt?: string | null;
  prizeReleaseAt?: string | null;
  maxTicketsPerUser?: number | null;
  lifecycleStatus?: BolaoLifecycleStatus;
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
  competitionDisplayNames: string[];
  resolvedLogoUrl: string | null;
  resolvedBannerUrl: string | null;
  resolvedIconVariant: string;
  datesLabel: string | null;
  priceLabel: string;
  estimatedPrizeLabel: string | null;
  participantCount: number;
  matchCount: number;
  remainingMatches: number;
  purchaseOpen: boolean;
  countdownToStartMs: number | null;
  countdownToEndMs: number | null;
};

export type BolaoDefinitionStats = {
  ticketsPaid: number;
  ticketsPending: number;
  revenueCents: number;
  participants: number;
  predictionsCount: number;
};

export type BolaoDefinitionWithStats = BolaoDefinition & BolaoDefinitionStats;

export type AdminBolaoHubItem = BolaoDefinitionWithStats & {
  resolvedLogoUrl: string | null;
  resolvedIconVariant: string;
  computedStatus: BolaoLifecycleStatus;
  datesLabel: string | null;
  competitionDisplayName: string;
  matchCount: number;
  /** Bolão legado/sistêmico — sem edição no wizard. */
  isLegacy?: boolean;
  /** Destino ao abrir o card (ex.: ranking legado). */
  detailHref?: string;
};

export type BolaoCatalogSections = {
  upcoming: BolaoDefinitionCatalogItem[];
  available: BolaoDefinitionCatalogItem[];
  closed: BolaoDefinitionCatalogItem[];
};

export type AdminMatchPickerItem = {
  matchId: number;
  competitionId: number;
  competitionName: string;
  dateBR: string;
  hour: string;
  homeName: string;
  homeSigla: string;
  homeLogo: string | null;
  awayName: string;
  awaySigla: string;
  awayLogo: string | null;
  rodada: number | null;
  status: string;
};

export type BolaoDefinitionAuditLog = {
  id: string;
  bolaoDefinitionId: string;
  action: string;
  actorUserId: string | null;
  actorEmail: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};
