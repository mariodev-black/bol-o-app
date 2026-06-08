import type { AdminBrasilMarrocosPromoDashboard } from "@/lib/admin/brasil-marrocos-placar-promo";

export type PromoEmailAudience = "free_ticket" | "shirt";

export type PromoEmailPreset = {
  audience: PromoEmailAudience;
  title: string;
  preview: string;
  body: string;
  includeEmailButton: boolean;
  buttonLabel: string;
  buttonUrl: string;
};

function formatOfficialScore(
  result: AdminBrasilMarrocosPromoDashboard["officialResult"],
): string {
  if (!result) return "2 x 1";
  return `${result.casa} x ${result.visitante}`;
}

export function buildBrasilMarrocosPromoEmailPresets(
  data: AdminBrasilMarrocosPromoDashboard,
): Record<PromoEmailAudience, PromoEmailPreset> {
  const score = formatOfficialScore(data.officialResult);
  const friendsGoal = data.friendsGoal;

  return {
    free_ticket: {
      audience: "free_ticket",
      title: "Parabéns! Você acertou o placar Brasil x Marrocos",
      preview: "Sua cota grátis no Bolão do Milhão foi liberada.",
      body: `Você acertou o placar exato do amistoso Brasil ${score} Marrocos na promoção do Bolão do Milhão! 🎉

Em breve nossa equipe entrará em contato para liberar sua cota grátis. Fique de olho no e-mail e no app.`,
      includeEmailButton: true,
      buttonLabel: "Ir para o Bolão",
      buttonUrl: "/boloes",
    },
    shirt: {
      audience: "shirt",
      title: "Parabéns! Você ganhou a camisa oficial",
      preview: `Placar exato + ${friendsGoal} indicações — camisa da Seleção liberada.`,
      body: `Você acertou o placar exato do amistoso Brasil ${score} Marrocos e completou ${friendsGoal} indicações válidas! 🏆

Sua camisa oficial da Seleção Brasileira será enviada em breve. Nossa equipe entrará em contato para confirmar endereço e tamanho.`,
      includeEmailButton: true,
      buttonLabel: "Abrir o app",
      buttonUrl: "/",
    },
  };
}

export function listBrasilMarrocosPromoWinnerUserIds(
  rows: AdminBrasilMarrocosPromoDashboard["rows"],
  audience: PromoEmailAudience,
): string[] {
  const filtered =
    audience === "shirt"
      ? rows.filter((row) => row.shirtPrizeEligible)
      : rows.filter((row) => row.freeTicketPrizeEligible);

  return filtered.map((row) => row.userId);
}

export function listBrasilMarrocosPromoWinnerRows(
  rows: AdminBrasilMarrocosPromoDashboard["rows"],
  audience: PromoEmailAudience,
) {
  return audience === "shirt"
    ? rows.filter((row) => row.shirtPrizeEligible)
    : rows.filter((row) => row.freeTicketPrizeEligible);
}
