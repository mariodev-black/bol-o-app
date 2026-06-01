-- Promo Brasil x Panamá — usuários com palpite IGUAL ao placar oficial.
-- Placar oficial: Brasil (casa) 6 x 2 Panamá (visitante).
-- Para mudar o resultado, altere só as duas linhas abaixo.

WITH placar_oficial AS (
  SELECT 6::smallint AS casa, 2::smallint AS visitante
),
indicacoes AS (
  SELECT
    s.user_id,
    s.pred_casa,
    s.pred_visitante,
    s.created_at,
    COUNT(ru.id)::int AS qtd_indicacoes
  FROM brasil_panama_placar_promo_submissions s
  LEFT JOIN users ru ON ru.referred_by_user_id = s.user_id
  GROUP BY s.user_id, s.pred_casa, s.pred_visitante, s.created_at
)
SELECT
  u.id,
  COALESCE(u.name, '—') AS nome,
  u.email,
  i.pred_casa || ' x ' || i.pred_visitante AS palpite,
  po.casa || ' x ' || po.visitante AS placar_oficial,
  i.qtd_indicacoes AS indicacoes,
  CASE WHEN i.qtd_indicacoes >= 3 THEN 'SIM' ELSE 'NAO' END AS elegivel_camisa,
  i.created_at AT TIME ZONE 'America/Sao_Paulo' AS enviado_em_brt
FROM indicacoes i
INNER JOIN users u ON u.id = i.user_id
CROSS JOIN placar_oficial po
WHERE i.pred_casa = po.casa
  AND i.pred_visitante = po.visitante
ORDER BY i.qtd_indicacoes DESC, i.created_at ASC;

-- Resumo
WITH placar_oficial AS (
  SELECT 6::smallint AS casa, 2::smallint AS visitante
)
SELECT
  (SELECT COUNT(*) FROM brasil_panama_placar_promo_submissions) AS total_palpites,
  COUNT(*) AS acertaram_placar_exato,
  COUNT(*) FILTER (
    WHERE (
      SELECT COUNT(*) FROM users ru WHERE ru.referred_by_user_id = s.user_id
    ) >= 3
  ) AS acertaram_e_3_ou_mais_indicacoes
FROM brasil_panama_placar_promo_submissions s
CROSS JOIN placar_oficial po
WHERE s.pred_casa = po.casa
  AND s.pred_visitante = po.visitante;
