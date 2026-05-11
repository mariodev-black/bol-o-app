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

Tickets diários **não** entram nessa soma (pool exclusivo do bolão principal).

Exemplo:

```text
Arrecadação com tickets gerais pagos: R$ 1.000.000
Pool de premiação: R$ 600.000
```

### Como escolhe os ganhadores

O sistema monta o ranking oficial de todos os tickets gerais pagos/aprovados.

Depois distribui o pool por posição/pessoa até o 2.506º ticket.

Essa tabela é proporcional ao pool real. O exemplo abaixo usa um pool-base de R$ 1.000.000 apenas para facilitar o entendimento.

| Posição | Prêmio no exemplo de R$ 1.000.000 | Percentual individual |
| --- | ---: | ---: |
| 1º | R$ 180.000,00 | 18,0000% |
| 2º | R$ 90.000,00 | 9,0000% |
| 3º | R$ 50.000,00 | 5,0000% |
| 4º | R$ 35.000,00 | 3,5000% |
| 5º | R$ 25.000,00 | 2,5000% |
| 6º | R$ 18.000,00 | 1,8000% |
| 7º | R$ 14.000,00 | 1,4000% |
| 8º | R$ 11.000,00 | 1,1000% |
| 9º | R$ 9.000,00 | 0,9000% |
| 10º | R$ 7.000,00 | 0,7000% |
| 11º ao 20º | R$ 5.052,00 cada | 0,5052% cada |
| 21º ao 50º | R$ 2.500,00 cada | 0,2500% cada |
| 51º ao 100º | R$ 1.200,00 cada | 0,1200% cada |
| 101º ao 250º | R$ 600,00 cada | 0,0600% cada |
| 251º ao 500º | R$ 300,00 cada | 0,0300% cada |
| 501º ao 1.000º | R$ 180,00 cada | 0,0180% cada |
| 1.001º ao 2.506º | R$ 80,00 cada | 0,0080% cada |

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

O pool do Bolão Diário é **separado do Bolão Geral**:

```text
60% da soma do valor pago (total_amount_cents) apenas dos tickets DIÁRIOS
pagos/aprovados que participam daquele dia de jogos.
```

O que **não** entra no pool diário:

- Tickets do bolão geral (`ticket_type = general`), em qualquer quantidade.
- Tickets diários de **outro** dia (outra data de primeira partida apostada).

O que entra:

- Somente `ticket_type = daily` com status pago ou aprovado, cuja **data do bolão diário** é aquela data (definida pela primeira partida em que o usuário apostou, igual ao ranking daquele dia).

Exemplo:

```text
Soma dos valores pagos só dos tickets daily do dia 12/05/2026: R$ 10.000
Pool de premiação diário (60%): R$ 6.000
(o bolão geral não entra nessa conta)
```

### Como escolhe os ganhadores

O sistema monta o ranking apenas dos tickets diários daquele dia.

A distribuição do Bolão Diário é diferente do Bolão Geral.

O Diário paga apenas o Top 10. A tabela abaixo também é proporcional ao pool real.

| Posição | Percentual individual da premiação |
| --- | ---: |
| 1º | 37,5931% |
| 2º | 18,7965% |
| 3º | 10,4436% |
| 4º | 7,5188% |
| 5º | 6,2657% |
| 6º | 5,0125% |
| 7º | 4,1774% |
| 8º | 3,7594% |
| 9º | 3,3417% |
| 10º | 3,0902% |

Se houver menos de 10 participantes, a sobra das posições vazias é redistribuída proporcionalmente entre os vencedores existentes.

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
Premia até o 2.506º ticket.
Prêmio cai no saldo principal do usuário.
```

Ticket Diário:

```text
Fecha no fim dos jogos daquele dia.
Pool = 60% dos tickets diários pagos/aprovados daquele dia.
Ranking usa apenas os jogos daquele dia.
Premia apenas o Top 10.
Prêmio cai no saldo principal do usuário.
```
