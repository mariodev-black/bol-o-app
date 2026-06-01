/**
 * Prêmio extra rodada (pos. 4–100): cota grátis no Bolão do Milhão (ticket general).
 */
import { getPool } from "@/lib/db";

export type ExtraRoundMilhaoGiftCampaign = "brasileirao_r18" | "libertadores_r6";

export type ExtraRoundMilhaoGiftCopy = {
  campaign: ExtraRoundMilhaoGiftCampaign;
  title: string;
  preview: string;
  body: string;
  pushTitle: string;
  pushPreview: string;
  emailSubject: string;
  emailButtonLabel: string;
  emailButtonUrl: string;
};

const COPY: Record<ExtraRoundMilhaoGiftCampaign, Omit<ExtraRoundMilhaoGiftCopy, "campaign">> = {
  brasileirao_r18: {
    title: "🎉 PARABÉNS! SUA COTA GRATUITA FOI LIBERADA 🎉",
    preview:
      "O bolão da 18ª rodada do Brasileirão foi finalizado e você ficou entre os premiados da rodada 🏆",
    body: `🎉 PARABÉNS! SUA COTA GRATUITA FOI LIBERADA 🎉

O bolão da 18ª rodada do Brasileirão foi finalizado e você ficou entre os premiados da rodada 🏆

Como prêmio, você ganhou uma participação GRATUITA no Bolão do Milhão, a maior competição de palpites da Copa do Mundo.

🏆 Mais de 2 milhões em premiações
⚽ Copa do Mundo inteira
📈 Classificação ao vivo
🎯 Do primeiro jogo até a final

Sua cota já está disponível na plataforma.

Agora é só acessar sua conta e se preparar para a maior disputa da Copa 🔥

👉 Acessar minha conta`,
    pushTitle: "🎉 Cota gratuita liberada!",
    pushPreview:
      "Você ganhou uma cota no Bolão do Milhão — 18ª rodada do Brasileirão. Toque para acessar.",
    emailSubject: "🎉 PARABÉNS! SUA COTA GRATUITA FOI LIBERADA 🎉",
    emailButtonLabel: "Acessar minha conta",
    emailButtonUrl: "/boloes",
  },
  libertadores_r6: {
    title: "🎉 PARABÉNS! SUA COTA GRATUITA FOI LIBERADA 🎉",
    preview:
      "O bolão da 6ª rodada da Libertadores foi finalizado e você ficou entre os premiados da rodada 🏆",
    body: `🎉 PARABÉNS! SUA COTA GRATUITA FOI LIBERADA 🎉

O bolão da 6ª rodada da Libertadores foi finalizado e você ficou entre os premiados da rodada 🏆

Como prêmio, você ganhou uma participação GRATUITA no Bolão do Milhão, a maior competição de palpites da Copa do Mundo.

🏆 Mais de 2 milhões em premiações
⚽ Copa do Mundo inteira
📈 Classificação ao vivo
🎯 Do primeiro jogo até a final

Sua cota já está disponível na plataforma.

Agora é só acessar sua conta e se preparar para a maior disputa da Copa 🔥

👉 Acessar minha conta`,
    pushTitle: "🎉 Cota gratuita liberada!",
    pushPreview:
      "Você ganhou uma cota no Bolão do Milhão — 6ª rodada da Libertadores. Toque para acessar.",
    emailSubject: "🎉 PARABÉNS! SUA COTA GRATUITA FOI LIBERADA 🎉",
    emailButtonLabel: "Acessar minha conta",
    emailButtonUrl: "/boloes",
  },
};

export function getExtraRoundMilhaoGiftCopy(
  campaign: ExtraRoundMilhaoGiftCampaign,
): ExtraRoundMilhaoGiftCopy {
  return { campaign, ...COPY[campaign] };
}

function externalRefForCampaign(
  campaign: ExtraRoundMilhaoGiftCampaign,
  userId: string,
): string {
  return `milhao_gift:${campaign}:${userId}`;
}

export async function findExistingMilhaoGiftTicket(
  userId: string,
  campaign: ExtraRoundMilhaoGiftCampaign,
): Promise<{ id: string } | null> {
  const pool = getPool();
  const ref = externalRefForCampaign(campaign, userId);
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM tickets
     WHERE external_ref = $1 AND status IN ('paid', 'approved')
     LIMIT 1`,
    [ref],
  );
  return rows[0] ?? null;
}

export async function grantMilhaoGiftTicketForUser(
  userId: string,
  campaign: ExtraRoundMilhaoGiftCampaign,
): Promise<
  | { ok: true; ticketId: string; alreadyGranted: boolean }
  | { ok: false; error: string }
> {
  const existing = await findExistingMilhaoGiftTicket(userId, campaign);
  if (existing) {
    return { ok: true, ticketId: existing.id, alreadyGranted: true };
  }

  const ref = externalRefForCampaign(campaign, userId);
  const pool = getPool();

  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO tickets (
         user_id, ticket_type, unit_price_cents, quantity, total_amount_cents,
         is_promo_bonus, status, external_ref, paid_at
       )
       VALUES ($1, 'general', 0, 1, 0, true, 'paid', $2, now())
       RETURNING id::text AS id`,
      [userId, ref],
    );
    if (rows[0]?.id) {
      return { ok: true, ticketId: rows[0].id, alreadyGranted: false };
    }
  } catch (err) {
    console.warn("[milhao-gift] insert error", {
      userId,
      campaign,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  const again = await findExistingMilhaoGiftTicket(userId, campaign);
  if (again) {
    return { ok: true, ticketId: again.id, alreadyGranted: true };
  }

  return { ok: false, error: "Falha ao criar cota grátis do Milhão." };
}
