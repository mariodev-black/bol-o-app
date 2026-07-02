/**
 * Origem do valor debitado na solicitação de saque.
 * "combined" = saque unificado (afiliado primeiro, depois carteira) — o
 * fluxo padrão desde que o saldo virou único para o usuário. "affiliate" e
 * "wallet" seguem existindo apenas em solicitações antigas (histórico).
 */
export type WithdrawalBalanceSource = "affiliate" | "wallet" | "combined";
