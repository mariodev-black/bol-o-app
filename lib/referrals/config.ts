/**
 * Programa de indicação: valores e faixas configuráveis por `.env`.
 * Comissão por pagamento aprovado (ticket pago). O nível do afiliado
 * define quanto recebe na N-ésima comissão (1ª, 2ª, …).
 */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export type ReferralTierId = "bronze" | "silver" | "gold" | "diamond";

export type ReferralProgramConfig = {
  rewardBronzeCents: number;
  rewardSilverCents: number;
  rewardGoldCents: number;
  rewardDiamondCents: number;
  /** A partir desta comissão (1-based), aplica prata */
  tierSilverMinCommissions: number;
  /** A partir desta comissão (1-based), aplica ouro */
  tierGoldMinCommissions: number;
  /** A partir desta comissão (1-based), aplica diamante */
  tierDiamondMinCommissions: number;
};

export function getReferralProgramConfig(): ReferralProgramConfig {
  return {
    rewardBronzeCents: intEnv("REFERRAL_REWARD_BRONZE_CENTS", 800),
    rewardSilverCents: intEnv("REFERRAL_REWARD_SILVER_CENTS", 1000),
    rewardGoldCents: intEnv("REFERRAL_REWARD_GOLD_CENTS", 1200),
    rewardDiamondCents: intEnv("REFERRAL_REWARD_DIAMOND_CENTS", 1500),
    tierSilverMinCommissions: intEnv("REFERRAL_TIER_SILVER_MIN_COMMISSIONS", 10),
    tierGoldMinCommissions: intEnv("REFERRAL_TIER_GOLD_MIN_COMMISSIONS", 25),
    tierDiamondMinCommissions: intEnv("REFERRAL_TIER_DIAMOND_MIN_COMMISSIONS", 50),
  };
}

/** N-ésima comissão paga (1-based): qual faixa de valor se aplica. */
export function tierForCommissionIndex(config: ReferralProgramConfig, commissionIndex: number): ReferralTierId {
  if (commissionIndex >= config.tierDiamondMinCommissions) return "diamond";
  if (commissionIndex >= config.tierGoldMinCommissions) return "gold";
  if (commissionIndex >= config.tierSilverMinCommissions) return "silver";
  return "bronze";
}

export function rewardCentsForTier(config: ReferralProgramConfig, tier: ReferralTierId): number {
  switch (tier) {
    case "bronze":
      return config.rewardBronzeCents;
    case "silver":
      return config.rewardSilverCents;
    case "gold":
      return config.rewardGoldCents;
    case "diamond":
      return config.rewardDiamondCents;
    default:
      return config.rewardBronzeCents;
  }
}

export function tierLabelPt(tier: ReferralTierId): string {
  switch (tier) {
    case "bronze":
      return "Bronze";
    case "silver":
      return "Prata";
    case "gold":
      return "Ouro";
    case "diamond":
      return "Diamante";
    default:
      return "Bronze";
  }
}

/** Nível “atual” do afiliado pelo número de comissões já creditadas (após último pagamento). */
export function currentTierFromPaidCount(config: ReferralProgramConfig, paidCommissionsCount: number): ReferralTierId {
  if (paidCommissionsCount <= 0) return "bronze";
  return tierForCommissionIndex(config, paidCommissionsCount);
}

/** Próxima comissão será o índice `paidCommissionsCount + 1`; retorna valor em centavos. */
export function nextRewardCents(config: ReferralProgramConfig, paidCommissionsCount: number): number {
  const nextIndex = paidCommissionsCount + 1;
  const tier = tierForCommissionIndex(config, nextIndex);
  return rewardCentsForTier(config, tier);
}
