# Relatório de Premiação — Bolão Geral e Bolão Skale

**Atualizado em:** 19/07/2026  
**Bolão geral:** valores operacionais fixos acordados

---

## Resumo

| Bolão | Participantes | Premiados | Pool total | Status |
|-------|---------------|-----------|------------|--------|
| **Geral (principal)** | **291** | **29** | **R$ 8.127,00** | Encerra após final ESP x ARG (+ 90s) |
| **Skale (90007)** | 39 | 3 | R$ 19.500,00 | Encerra após final ESP x ARG (+ 90s) |

---

## Bolão Geral — premiação fixa

| Métrica | Valor |
|---------|-------|
| Participantes | **291** cotas |
| Premiados | **29** (Top 29 do ranking) |
| Pool total | **R$ 8.127,00** |
| Final | Espanha x Argentina — placar exato = **10 pts** |

### Distribuição (Top 29, pesos proporcionais sobre R$ 8.127)

| Pos | % do pool | Prêmio |
|-----|-----------|--------|
| 1º | 18% | R$ 1.462,86 |
| 2º | 9% | R$ 731,43 |
| 3º | 5% | R$ 406,35 |
| 4º | 3,5% | R$ 284,45 |
| 5º | 2,5% | R$ 203,18 |
| 6º–10º | … | proporcional |
| 11º–29º | … | proporcional |

> Ranking real no banco. Após a final, **90 segundos** depois o sistema credita o prêmio no saldo dos 29 primeiros.

---

## Bolão Skale

| Métrica | Valor |
|---------|-------|
| Cotas pagas | 39 |
| Pool | R$ 19.500,00 (100%) |
| Premiados | Top 3 (60% / 30% / 10%) |

---

## Config (.env)

```env
GENERAL_BOLAO_FIXED_PRIZE_ENABLED=true
GENERAL_BOLAO_FIXED_POOL_CENTS=812700
GENERAL_BOLAO_FIXED_WINNER_COUNT=29
GENERAL_BOLAO_FIXED_PARTICIPANT_COUNT=291
PRIZE_GENERAL_GRACE_AFTER_FINAL_SECONDS=90
```
