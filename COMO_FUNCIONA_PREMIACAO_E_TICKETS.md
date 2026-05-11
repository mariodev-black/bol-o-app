# Como funciona a pontuação e premiação

Este documento explica, na teoria, como o sistema processa os palpites, calcula a pontuação, fecha os bolões e paga os prêmios para cada tipo de ticket.

## Tipos de ticket

O sistema trabalha com dois tipos principais de ticket:

- Ticket Geral
- Ticket Diário

Os dois usam a mesma regra de pontuação, mas fecham em momentos diferentes e usam pools de premiação diferentes.

## Pontuação oficial

Cada palpite é comparado com o placar real da partida.

Regras de pontuação:

| Situação | Pontos |
| --- | ---: |
| Placar exato | 6 |
| Acertou vencedor ou empate + acertou gols de pelo menos uma equipe | 4 |
| Acertou vencedor ou empate, sem placar exato | 3 |
| Errou vencedor/empate, mas acertou gols de uma equipe | 1 por equipe |
| Errou tudo | 0 |

Exemplos:

| Resultado | Palpite | Motivo | Pontos |
| --- | --- | --- | ---: |
| 2x1 | 2x1 | Placar exato | 6 |
| 2x1 | 2x0 | Vencedor + gols do mandante | 4 |
| 3x1 | 2x1 | Vencedor + gols do visitante | 4 |
| 2x1 | 1x0 | Acertou vencedor | 3 |
| 2x2 | 1x1 | Acertou empate | 3 |
| 2x1 | 0x1 | Acertou gols do visitante | 1 |
| 2x1 | 0x0 | Errou tudo | 0 |

Importante: placar exato vale apenas 6 pontos. Não soma pontos extras por gols.

## Critérios de classificação

Depois que as partidas têm resultado, o ranking é ordenado assim:

1. Maior pontuação total
2. Maior quantidade de placares exatos
3. Maior quantidade de vencedores/empates acertados
4. Maior quantidade de gols acertados
5. Maior sequência de acertos
6. Palpite enviado primeiro

## Ticket Geral

O Ticket Geral participa do bolão principal da competição inteira.

### Quando fecha

O Ticket Geral só é processado oficialmente quando o último jogo da competição terminar.

Exemplo:

- A Copa ainda tem jogos em aberto: o ranking continua vivo.
- O último jogo terminou: o sistema fecha o Bolão Geral.

### Como calcula o pool

O pool do Bolão Geral é:

```text
60% do valor total dos tickets gerais pagos/aprovados
```

Exemplo:

```text
Arrecadação com tickets gerais pagos: R$ 1.000.000
Pool de premiação: R$ 600.000
```

### Como escolhe os ganhadores

O sistema monta o ranking oficial de todos os tickets gerais pagos/aprovados.

Depois distribui o pool conforme as faixas:

| Faixa | Percentual do pool |
| --- | ---: |
| Top 10 | 45% |
| 11º ao 50º | 13% |
| 51º ao 500º | 17% |
| 501º ao 5.000º | 15% |
| 5.001º ao 10.000º | 10% |

No Top 10, a divisão é ponderada:

| Posição | Percentual do pool |
| --- | ---: |
| 1º | 18% |
| 2º | 8% |
| 3º | 5% |
| 4º | 3,5% |
| 5º | 2,8% |
| 6º | 2,2% |
| 7º | 1,7% |
| 8º | 1,4% |
| 9º | 1,2% |
| 10º | 1,2% |

As demais faixas são divididas igualmente entre os ganhadores daquela faixa.

Se tiver menos ganhadores do que posições premiadas, a sobra é redistribuída proporcionalmente entre os vencedores existentes.

### Como paga

Para cada ganhador:

1. O sistema cria um registro de fechamento em `prize_closures`.
2. O sistema cria um prêmio em `prize_awards`.
3. O sistema cria uma transação interna com provider `internal_prize`.
4. O valor é creditado em `users.balance_cents`.

Descrição esperada da transação:

```text
Premiacao Bolao Geral - Ticket <id_do_ticket> - <posição> lugar
```

## Ticket Diário

O Ticket Diário participa apenas dos jogos de um dia específico.

### Qual dia vale para o ticket

O dia do Ticket Diário é definido pelos jogos em que o usuário palpita.

Na prática, o sistema usa a data da primeira partida apostada daquele ticket para agrupar o ticket no bolão diário daquele dia.

Exemplo:

```text
Ticket diário apostou em jogos de 12/05/2026
Esse ticket entra no ranking diário de 12/05/2026
```

### Quando fecha

O Ticket Diário fecha quando todos os jogos daquele dia terminarem.

Exemplo:

- Dia 12/05/2026 tem 3 jogos.
- Enquanto existir jogo aberto, o diário não fecha.
- Quando os 3 jogos terminarem, o sistema processa o ranking diário daquele dia.

Jogos cancelados, adiados, suspensos ou interrompidos não bloqueiam o fechamento. Se não tiverem placar válido, pontuam 0.

### Como calcula o pool

O pool do Bolão Diário é:

```text
60% do valor total dos tickets diários pagos/aprovados daquele dia
```

Exemplo:

```text
Arrecadação com tickets diários do dia 12/05/2026: R$ 10.000
Pool de premiação diário: R$ 6.000
```

### Como escolhe os ganhadores

O sistema monta o ranking apenas dos tickets diários daquele dia.

A distribuição usa a mesma tabela de faixas do Bolão Geral:

| Faixa | Percentual do pool |
| --- | ---: |
| Top 10 | 45% |
| 11º ao 50º | 13% |
| 51º ao 500º | 17% |
| 501º ao 5.000º | 15% |
| 5.001º ao 10.000º | 10% |

Se houver poucos participantes, o valor que sobraria das posições vazias é redistribuído proporcionalmente entre os ganhadores existentes.

### Como paga

Para cada ganhador:

1. O sistema cria um fechamento diário em `prize_closures`.
2. O sistema cria o prêmio em `prize_awards`.
3. O sistema cria uma transação interna com provider `internal_prize`.
4. O valor é creditado em `users.balance_cents`.

Descrição esperada da transação:

```text
Premiacao Bolao Diario <data> - Ticket <id_do_ticket> - <posição> lugar
```

## Segurança contra pagamento duplicado

O processamento é idempotente.

Isso significa que, se a sincronização rodar mais de uma vez, o sistema não deve pagar o mesmo prêmio duas vezes.

As travas principais são:

- Uma chave única por fechamento em `prize_closures`.
- Uma chave única por ticket premiado dentro do fechamento em `prize_awards`.
- Uso de advisory lock no processamento automático.

## Quando o processamento roda

O processamento roda automaticamente depois que o sistema sincroniza partidas com a API de futebol.

Fluxo resumido:

```text
API Futebol atualiza partidas
        ↓
Sistema atualiza matches_cache
        ↓
Sistema verifica se algum bolão diário fechou
        ↓
Sistema verifica se o bolão geral fechou
        ↓
Sistema calcula ranking oficial
        ↓
Sistema calcula prêmios
        ↓
Sistema cria transações internas
        ↓
Sistema credita o saldo principal dos ganhadores
```

## Resumo rápido

Ticket Geral:

```text
Fecha no fim do último jogo da competição.
Pool = 60% dos tickets gerais pagos/aprovados.
Ranking usa todos os jogos da competição.
Prêmio cai no saldo principal do usuário.
```

Ticket Diário:

```text
Fecha no fim dos jogos daquele dia.
Pool = 60% dos tickets diários pagos/aprovados daquele dia.
Ranking usa apenas os jogos daquele dia.
Prêmio cai no saldo principal do usuário.
```
