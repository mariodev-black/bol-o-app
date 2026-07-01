# Bolão Engine Dinâmico — Documentação Técnica

> Referência completa do sistema de bolões configuráveis via admin (`bolao_definitions`), convivendo com os bolões legados (Principal, Diário, Extra, Skale, etc.).
>
> **Público:** desenvolvedores e IAs que precisam entender ou estender o motor sem ler o código inteiro.
>
> **Última revisão:** maio/2026

---

## Índice

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Dois pipelines de premiação](#2-dois-pipelines-de-premiação)
3. [Modelo de dados](#3-modelo-de-dados)
4. [Escopo de jogos](#4-escopo-de-jogos)
5. [Ciclo de vida (lifecycle)](#5-ciclo-de-vida-lifecycle)
6. [Apuração e settlement](#6-apuração-e-settlement)
7. [Premiação dinâmica](#7-premiação-dinâmica)
8. [Ranking](#8-ranking)
9. [Palpites](#9-palpites)
10. [Compra e checkout](#10-compra-e-checkout)
11. [Catálogo e vitrine](#11-catálogo-e-vitrine)
12. [Admin hub (legado + dinâmico)](#12-admin-hub-legado--dinâmico)
13. [Wizard de criação](#13-wizard-de-criação)
14. [Automação e cron](#14-automação-e-cron)
15. [Cache de partidas](#15-cache-de-partidas)
16. [APIs relevantes](#16-apis-relevantes)
17. [Variáveis de ambiente](#17-variáveis-de-ambiente)
18. [Mapa de arquivos](#18-mapa-de-arquivos)
19. [Fluxos ponta a ponta](#19-fluxos-ponta-a-ponta)
20. [Convivência legado × dinâmico](#20-convivência-legado--dinâmico)
21. [Limitações e pendências conhecidas](#21-limitações-e-pendências-conhecidas)

---

## 1. Visão geral da arquitetura

O projeto opera com **dois modos de bolão** que compartilham infraestrutura (cache de partidas, pontuação, tabelas de prêmio) mas têm pipelines distintos:

| Aspecto | Legado | Dinâmico (`bolao_definitions`) |
|---------|--------|--------------------------------|
| Configuração | Código + env (comp IDs, edições) | Admin wizard → banco |
| Ticket | `tickets.bolao_definition_id IS NULL` | `tickets.bolao_definition_id = uuid` |
| Escopo de jogos | Por tipo (geral/diário/extra/rodada) | `scopeMatchesForBolaoDefinition()` |
| Premiação | `lib/prizes/processor.ts` | `lib/boloes/definitions/prize-processor.ts` |
| Closure key | `{compId}:general`, `{compId}:daily:...` | `definition:{uuid}` |
| Ranking API | `mode=principal\|diario\|extra` | `mode=dynamic&definitionId=` |
| Lifecycle | Implícito / cron legado | `runBolaoLifecycleTick()` a cada 5 min |

### Diagrama de alto nível

```
                    ┌─────────────────────────────────────┐
                    │         Admin (/admin/boloes)        │
                    │  Hub legado + cards dinâmicos        │
                    │  Wizard → bolao_definitions          │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
   ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
   │   Catálogo   │           │   Checkout   │           │   Cron 5min  │
   │  /boloes     │           │  /tickets    │           │ bolao-lifecycle│
   └──────┬───────┘           └──────┬───────┘           └──────┬───────┘
          │                          │                          │
          └──────────────────────────┼──────────────────────────┘
                                     ▼
                          ┌─────────────────────┐
                          │  tickets (paid)      │
                          │  bolao_definition_id │
                          └──────────┬──────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
       │  Palpites   │       │   Ranking   │       │  Premiação  │
       │ escopo def  │       │ mode=dynamic│       │ prize-proc  │
       └─────────────┘       └─────────────┘       └─────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  matches_cache       │
                          │  fetchMatchesMap()   │
                          └─────────────────────┘
```

---

## 2. Dois pipelines de premiação

### Pipeline legado

- **Arquivo principal:** `lib/prizes/processor.ts`
- **Disparo:** sincronização de partidas / cron de match sync (`processPrizeClosuresAfterMatchSync`)
- **Closure keys:** por competição + tipo + data/edição (ex.: `90001:extra:round:17`)
- **Isolamento:** todas as queries de tickets legados incluem `AND bolao_definition_id IS NULL` para não misturar receita de bolões dinâmicos

### Pipeline dinâmico

- **Arquivo principal:** `lib/boloes/definitions/prize-processor.ts` → `processDefinitionPrizeClosure()`
- **Disparo:** `lib/boloes/definitions/lifecycle-worker.ts` → `runBolaoLifecycleTick()` via cron
- **Closure key:** `definition:{bolaoDefinitionId}` (única por definição)
- **Pré-condições:** `isDefinitionReadyForSettlement()` **e** `isDefinitionReadyForPrizeRelease()`

Ambos escrevem nas mesmas tabelas: `prize_closures`, `prize_awards`, `transactions`, e creditam `users.balance_cents`.

---

## 3. Modelo de dados

### Tabela `bolao_definitions`

DDL bootstrap: `lib/boloes/definitions/schema.ts`  
Migrations SQL: `scripts/sql/20260612-bolao-definitions.sql`, `scripts/sql/20260527-bolao-engine-v2.sql`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | Identificador único |
| `slug` | text UNIQUE | URL-friendly, gerado do nome |
| `display_name` | text | Nome exibido na vitrine |
| `subtitle` | text | Subtítulo (competição, rodada, etc.) |
| `description` | text | Texto longo na vitrine |
| `ticket_type` | text | `general` \| `daily` \| `extra` |
| `competition_id` | integer | Competição principal |
| `competition_ids` | integer[] | Multi-campeonato |
| `scope_mode` | text | Modo de escopo (ver §4) |
| `scope_dates` | text[] | Datas DD/MM/YYYY |
| `scope_match_ids` | bigint[] | IDs de partidas (custom) |
| `scope_config` | jsonb | Regras por competição |
| `round_number` | integer | Rodada fixa |
| `edition_number` | integer | Edição diária (1–11) |
| `unit_price_cents` | integer | Preço da cota |
| `sale_enabled` | boolean | Venda ativa |
| `shop_visible` | boolean | Aparece na loja |
| `enabled` | boolean | Bolão ativo (soft delete = false) |
| `sort_order` | integer | Ordem no catálogo |
| `logo_url`, `banner_url` | text | Mídia custom |
| `use_competition_logo` | boolean | Fallback para logo da competição |
| `prize_pool_bps` | integer | % da arrecadação (6000 = 60%) |
| `prize_tiers` | jsonb | `[{ rank, poolBps, amountCents? }]` |
| `scoring_config` | jsonb | Config de pontuação (reservado) |
| `starts_at`, `ends_at` | timestamptz | Janela de inscrições |
| `settlement_at` | timestamptz | **Apuração fixa** (piso de data/hora) |
| `prize_release_at` | timestamptz | **Liberação de prêmio** (piso para crédito) |
| `max_tickets_per_user` | integer | Limite por usuário (reservado no checkout) |
| `lifecycle_status` | text | Status persistido |
| `metadata` | jsonb | `{ legacy, duplicatedFrom, ... }` |

### Tabelas relacionadas

| Tabela | Relação |
|--------|---------|
| `tickets.bolao_definition_id` | FK nullable — liga cota à definição |
| `predictions` | Palpites por `ticket_id` + `match_id` |
| `prize_closures` | Fechamento por `closure_key` |
| `prize_awards` | Prêmio por usuário/ticket/rank |
| `transactions` | Crédito `internal_prize` no saldo |
| `bolao_definition_audit_logs` | Auditoria de ações admin/cron |
| `matches_cache` | Partidas sincronizadas da API |

### Tipos TypeScript

Arquivo: `lib/boloes/definitions/types.ts`

- `BolaoDefinition` — entidade completa
- `BolaoDefinitionInput` — payload de create/update
- `BolaoPrizeTier` — `{ rank, poolBps, amountCents? }`
- `BolaoLifecycleStatus` — estados do ciclo de vida
- `BolaoDefinitionCatalogItem` — item enriquecido para vitrine

### Repository

Arquivo: `lib/boloes/definitions/repository.ts`

Funções principais:
- `listBolaoDefinitions()`, `listBolaoDefinitionsForShop()`
- `getBolaoDefinitionById()`, `getBolaoDefinitionsByIds()`
- `createBolaoDefinition()`, `updateBolaoDefinition()`, `deleteBolaoDefinition()`
- `duplicateBolaoDefinition()`, `updateBolaoLifecycleStatus()`
- `countPaidTicketsForDefinition()`, `countParticipantsForDefinition()`

Mapper: `lib/boloes/definitions/mapper.ts` — converte snake_case DB ↔ camelCase app.

---

## 4. Escopo de jogos

**Arquivo central:** `lib/boloes/definitions/scope.ts` → `scopeMatchesForBolaoDefinition(def, matches)`

### Modos de escopo (`scope_mode`)

| Modo | Comportamento |
|------|---------------|
| `full_competition` | Todos os jogos da competição |
| `custom_matches` | Apenas `scope_match_ids` / `scope_config.competitions[].matchIds` |
| `daily_dates` | Jogos em `scope_dates` ou edição diária |
| `round` | Jogos da `round_number` |
| `weekend` | Sábado e domingo |
| `multi_competition` | Regras por competição em `scope_config` |

### Uso do escopo no sistema

| Onde | Função |
|------|--------|
| Palpites (UI) | `filterPalpitesJogos({ definitionScopeMatchIds })` |
| Palpites (save) | `matchBelongsToBolaoDefinition()` em `validate-palpite-save.ts` |
| Ranking | `buildDefinitionRanking()` — só palpites em match IDs do escopo |
| Lifecycle / ao vivo | `buildLifecycleContext()` — status baseado nos jogos do escopo |
| Settlement | `isDefinitionReadyForSettlement()` — último jogo do escopo |
| Progresso da cota | `scopeMatchesForPaidTicket()` em `lib/boloes/ticket-match-scope.ts` |
| Admin hub | `matchCount` = quantidade de jogos no escopo |

### Ticket com definição

`scopeMatchesForPaidTicket()` verifica **`ticket.bolaoDefinition` primeiro** (antes de regras legado general/extra/rodada) e delega para `scopeMatchesForBolaoDefinition()`.

---

## 5. Ciclo de vida (lifecycle)

### Estados (`BolaoLifecycleStatus`)

| Status | Label PT | Significado |
|--------|----------|-------------|
| `programado` | Programado | Antes de `starts_at`, nenhum jogo começou |
| `aberto` | Aberto | Venda aberta (`sale_enabled && enabled`) |
| `ao_vivo` | Ao vivo | Algum jogo do escopo em andamento ou já iniciou |
| `encerrado` | Encerrado | Todos os jogos finalizados, prêmio ainda não liberado |
| `finalizado` | Finalizado | Ranking publicado (reservado) |
| `premiacao_liberada` | Premiação liberada | Prêmios creditados no saldo |

Labels: `lib/boloes/definitions/lifecycle-labels.ts`

### Cálculo

**Arquivo:** `lib/boloes/definitions/lifecycle.ts`

```
fetchMatchesMap()
    → scopeMatchesForBolaoDefinition(def, matches)
    → buildLifecycleContext(def, matches, { prizesReleased, rankingPublished })
    → computeBolaoLifecycleStatus(def, ctx)
    → (opcional) updateBolaoLifecycleStatus()
```

**Prioridade de decisão** (simplificada):
1. Se prêmio já liberado → `premiacao_liberada`
2. Se ranking publicado → `finalizado`
3. Se todos os jogos finalizados → `encerrado` / `finalizado` / `premiacao_liberada`
4. Se algum jogo ao vivo ou kickoff passou → **`ao_vivo`**
5. Se antes de `starts_at` → `programado`
6. Se após `ends_at` → `encerrado`
7. Caso contrário → `aberto`

**Status ao vivo** reconhecidos: `em_andamento`, `intervalo`, `live`, `ao_vivo`, `primeiro_tempo`, `segundo_tempo`.

---

## 6. Apuração e settlement

**Arquivo:** `lib/boloes/definitions/settlement.ts`

### Duas formas de apurar

| Método | Campo / regra | Quando usar |
|--------|---------------|-------------|
| **Data fixa** | `settlement_at` | Admin define datetime exato de apuração |
| **Último jogo + grace** | kickoff do último jogo do escopo + margem | Padrão quando `settlement_at` é null |

### `isDefinitionReadyForSettlement(def, scoped, nowMs)`

Todas as condições devem ser verdadeiras:

1. `scoped.length > 0`
2. Se `settlement_at` definido → `now >= settlement_at`
3. Se `full_competition` ou `ticket_type = general` → **nenhum kickoff futuro** no escopo
4. `areAllScopedMatchesFinished(scoped)` — todos encerrados (placar ou status terminal)
5. `now >= lastKickoff + grace`

### Grace period (margem após último apito)

| Tipo de bolão | Env var | Default |
|---------------|---------|---------|
| Diário / `daily_dates` / rodada (não geral) | `PRIZE_DAILY_GRACE_AFTER_LAST_KICKOFF_MINUTES` | 180 min (3h), max 600 |
| Geral / competição inteira | `PRIZE_GENERAL_GRACE_HOURS_AFTER_LAST_KICKOFF` | 36h, max 168h |

Função auxiliar: `usesDailySettlementGrace(def)` decide qual grace aplicar.

### Liberação de prêmio

`isDefinitionReadyForPrizeRelease(def, nowMs)`:
- Se `prize_release_at` definido → `now >= prize_release_at`
- Senão → igual ao settlement (libera junto)

### Diferença: ao vivo vs apuração

- **`ao_vivo`** (lifecycle): qualquer jogo iniciou ou está live — atualização visual imediata
- **Settlement**: exige todos finalizados + grace — usado para fechar ranking e pagar prêmios

---

## 7. Premiação dinâmica

### Cálculo do pool

**Arquivo:** `lib/boloes/definitions/prizes.ts`

```typescript
poolCents = floor(revenueCents * prizePoolBps / 10000)
```

`revenueCents` = soma de `tickets.total_amount_cents` pagos com `bolao_definition_id = def.id`.

### Colocações: fixo + percentual

`calculateDefinitionPrizeAwards(poolCents, rankingLength, prizeTiers)`:

1. Tiers com `amountCents > 0` → prêmio **fixo** (deduzido do pool)
2. Pool restante dividido entre tiers com `poolBps` (soma deve ser 10000 = 100%)
3. Último tier dinâmico recebe o resto (evita perda por arredondamento)

**Exemplos:**
- Só % do pool: `{ rank: 1, poolBps: 5000 }`, `{ rank: 2, poolBps: 3000 }`, `{ rank: 3, poolBps: 2000 }`
- Só fixo: `{ rank: 1, amountCents: 50000 }` com `prizePoolBps: 0`
- Misto: 1º lugar R$ 500 fixo + 2º/3º splitam o pool restante

### Processamento (`processDefinitionPrizeClosure`)

**Arquivo:** `lib/boloes/definitions/prize-processor.ts`

```
1. Verificar settlement + prize release
2. closure_key = "definition:{id}" — skip se já processado
3. buildDefinitionRanking(def, matches)
4. calculateDefinitionPrizeAwards(...)
5. Para cada vencedor: creditAward()
6. UPDATE tickets SET settled_at, settled_closure_id
7. lifecycle_status = "premiacao_liberada"
8. audit log
```

### Crédito no saldo (`creditAward`)

1. `INSERT prize_awards ON CONFLICT DO NOTHING`
2. `external_ref = "definition_prize:{defId}:rank:{rank}"`
3. Verifica transação existente (anti double-pay)
4. `INSERT transactions` (`provider='internal_prize'`, `status='paid'`)
5. `UPDATE users SET balance_cents += amount`

### Anti double-pay (legado + dinâmico)

| Camada | Mecanismo |
|--------|-----------|
| Closure | `prize_closures.closure_key` UNIQUE |
| Award | `UNIQUE (closure_id, ticket_id)` |
| Transação | `external_ref` UNIQUE por usuário |
| Tickets legado | `bolao_definition_id IS NULL` nas queries |
| Tickets dinâmicos | `settled_at` / `settled_closure_id` |

---

## 8. Ranking

### Ranking por definição

**Arquivo:** `lib/boloes/definitions/ranking.ts` → `buildDefinitionRanking(def, matches)`

- Busca tickets `paid`/`approved` com `bolao_definition_id = def.id`
- Considera apenas palpites cujo `match_id` está no escopo
- Pontuação: `calcPredictionPoints()` (fórmula Copa padrão)
- Desempate: pontos → exatos → outcome → gols → `firstSubmitAt` (mais cedo ganha)

**Wrapper público:** `lib/ranking/leaderboard.ts` → `buildLeaderboardForDefinition(definitionId)`
- Enriquece com avatares, stats, meta (`participantCount`, `poolCentsApprox`, `hasLiveMatchesInPool`)

### Modo dynamic nos escopos

**Arquivos:** `lib/ranking/scopes.ts`, `lib/ranking/scopes-shared.ts`

Tickets com `bolaoDefinitionId` geram escopo:
```typescript
{
  key: "def:{uuid}",
  mode: "dynamic",
  definitionId: def.id,
  ticketId: t.id,
  ...
}
```

Resolução de deep link `/ranking?default=`:
- `def:{uuid}` — direto
- `{ticketUuid}` — resolve para o escopo da cota

Helper: `rankingDefaultScopeKey(ticketId, definitionId)` → preferência por `def:{id}`.

### API de ranking

```
GET /api/ranking/board?mode=dynamic&definitionId={uuid}
```

Requer usuário autenticado com cota paga na definição.

**Client:** `lib/ranking/load-board-client.ts` → `fetchRankingBoardClient(bolaoType, ticketId, { definitionId })`

**Bootstrap:** `GET /api/ranking/bootstrap?default=def:{uuid}` — carrega escopos + board inicial.

### Cache no client (ranking page)

`RankingExperience.tsx`:
- Cache em memória por `scope.key`
- 45s padrão / 12s quando `hasLiveMatchesInPool`
- Poll de partidas ao vivo via `/api/partidas` com live sync

### Admin ranking

`GET /api/admin/boloes/ranking?type=definition&id={uuid}`  
UI: `/admin/boloes/definicoes/[id]` → `BolaoRankingPanel`

---

## 9. Palpites

### Carregamento da página

**Arquivo:** `app/(authenticated)/palpites/page.tsx` → `buildInitialData()`

Fluxo para cota dinâmica:
1. Lê `bolao_definition_id` do ticket
2. Carrega definição via `getBolaoDefinitionById()`
3. Mapeia `ticket_type`: `general→principal`, `daily→diario`, `extra→extra`
4. Calcula `definitionScopeMatchIds` via `scopeMatchesForBolaoDefinition()`
5. Filtra jogos com `filterPalpitesJogos({ definitionScopeMatchIds })`
6. Multi-campeonato: merge de `getPartidasFasesFromDb()` por `competition_ids`
7. Passa `bolaoDefinitionId` no `PalpitesInitialData`

**Filtro:** `lib/boloes/palpites-jogos-filter.ts` — se `definitionScopeMatchIds` presente, **só esses IDs** (prioridade sobre filtros de rodada/diário).

### Validação no save

**Arquivos:**
- `lib/palpites/palpite-save-context.ts` → `buildPalpiteSaveContext()`
- `lib/palpites/validate-palpite-save.ts` → `validatePalpiteForSave()`

Se `bolaoDefinition` presente:
1. `matchBelongsToBolaoDefinition(def, matchMap, matchId)` — partida no escopo
2. Partida existe no calendário oficial
3. `isMatchOpenForPalpite()` — lock antes do kickoff

### Ticket meta

**Arquivo:** `lib/palpites/ticket-meta.ts` → `resolveOwnedTicketMeta()`

Retorna `bolaoDefinitionId` + `bolaoDefinition` completos para contexto de save e UI.

### Ranking na aba Palpites

`PalpitesClient.tsx` chama:
```typescript
fetchRankingBoardClient(bolaoType, ticketId, { definitionId: bolaoDefinitionId })
```

Links "Ranking completo" usam `rankingDefaultScopeKey(ticketId, bolaoDefinitionId)`.

### Disponibilidade de jogos (Meus bolões)

**Arquivo:** `lib/payments/user-tickets.ts`

Branch dedicado para `t.bolaoDefinition`:
- Usa `scopeMatchesForPaidTicket()` para listar jogos do escopo
- Calcula `availableGames` respeitando lock de kickoff
- Define `dailyStatus`: `disponivel` | `em_uso` | `usado`

---

## 10. Compra e checkout

### Entrada

- Catálogo: `/tickets?definitionId={uuid}` (`DynamicBolaoCatalog.tsx`)
- `TicketsPageClient.tsx` lê search param → `TicketCheckoutFlow.initialDefinitionId`

### Loja

**API:** `GET /api/deposits/transactions` retorna `catalogBoloes` de `listBolaoDefinitionsForSale()`.

**Comportamento:** se existem definições ativas na loja, `TicketCheckoutFlow` mostra **apenas catálogo dinâmico** (esconde UI legado principal/diário/extra).

### Pipeline de compra

```
POST /api/deposits/transactions
  definitionsById: { [uuid]: qty }
    → createDepositTransaction() [lib/payments/transactions.ts]
    → getBolaoDefinitionsByIds + isBolaoDefinitionPurchaseOpen()
    → buildDefinitionPurchaseLines() [lib/boloes/definitions/purchase.ts]
    → INSERT tickets (bolao_definition_id, status=pending_payment)
    → Pagamento confirmado → status=paid
    → Palpites/ranking usam escopo da definição
```

**Arquivo de purchase:** `lib/boloes/definitions/purchase.ts` — valida venda aberta, escopo com jogos, preço.

---

## 11. Catálogo e vitrine

### Construção

**Arquivo:** `lib/boloes/definitions/catalog.ts` → `buildBolaoCatalogSections()`

| Seção | Status lifecycle |
|-------|------------------|
| `upcoming` | `programado` |
| `available` | `aberto`, `ao_vivo` |
| `closed` | `encerrado`, `finalizado`, `premiacao_liberada` |

Enriquecimento (`enrichBolaoDefinitionCatalog`):
- Logo, ícone, nomes de competição
- `participantCount`, `estimatedPrizeLabel` (receita real × pool %)
- `purchaseOpen`, countdowns, `datesLabel`

### Páginas

- **SSR:** `app/(authenticated)/boloes/page.tsx` — vitrine principal + meus bolões
- **Client poll:** `DynamicBolaoCatalog.tsx` — refresh a cada 30s via `GET /api/boloes/catalog`
- **Badge ao vivo:** pulse vermelho quando `lifecycleStatus === 'ao_vivo'`

### Cards "Meus bolões"

Usam `scopeMatchesForPaidTicket()` + `bolaoStatusFromMetrics()` para progresso e fase "Ao vivo".

---

## 12. Admin hub (legado + dinâmico)

### Arquivos

| Arquivo | Função |
|---------|--------|
| `lib/admin/bolao-hub-legacy-items.ts` | Cards sintéticos legados |
| `lib/admin/bolao-hub-items.ts` | Merge legado + dinâmico |
| `lib/admin/bolao-hub-logo.ts` | Logos corretas por variante |
| `lib/boloes/definitions/legacy-bolao.ts` | `isLegacyBolaoDefinition()`, `isSyntheticCompetitionId()` |
| `app/admin/(panel)/boloes/_components/AdminBoloesHubClient.tsx` | UI do hub |
| `app/admin/(panel)/boloes/_components/AdminBolaoDefinitionCard.tsx` | Card dinâmico |

### Cards legados (sintéticos)

IDs como `legacy:principal`, `legacy:artilheiros`, `90007:copa`, edições diárias, extras por rodada.

- Badge **Sistema**
- Sem botões Editar/Duplicar/Desativar
- Link para páginas legado (`/admin/boloes/principal`, etc.)

### Cards dinâmicos

De `listBolaoDefinitionsWithStats()` + lifecycle computado + stats reais.

### Regra de deduplicação

`buildAdminBolaoHubItems()` remove definições DB que duplicam competição já coberta por card legado (`isLegacyBolaoDefinition` + `legacyCompetitionIds`).

---

## 13. Wizard de criação

**Arquivo:** `app/admin/(panel)/boloes/definicoes/_components/BolaoCreateWizard.tsx`  
**Rotas:** `/admin/boloes/definicoes/novo`, `/admin/boloes/definicoes/[id]/edit`

### Passos

| # | Título | Campos |
|---|--------|--------|
| 1 | Nome e logo | `displayName`, `logoUrl` |
| 2 | Valor da cota | `unitPriceCents` |
| 3 | Campeonatos e jogos | `competitionIds[]`, seleção de partidas por competição |
| 4 | Detalhes | `subtitle`, `description`, `startsAt`, `endsAt`, **`settlementAt`**, **`prizeReleaseAt`**, `maxTicketsPerUser`, premiação |
| 5 | Publicar | `saleEnabled`, `shopVisible`, revisão |

### Valores fixos no save (`buildInput()`)

```typescript
ticketType: "extra"           // wizard atual sempre extra
scopeMode: "custom_matches"   // jogos selecionados manualmente
enabled: true
```

### Premiação no wizard

- Pool % da arrecadação (`prizePoolBps`)
- Por colocação: **% do pool** e/ou **valor fixo R$** (`amountCents`)
- Validação: tiers com poolBps devem somar 100%; ou só fixos com pool 0%

### APIs do wizard

- `GET /api/admin/boloes/definitions/competitions` — picker de campeonatos
- `GET /api/admin/boloes/definitions/matches` — picker de jogos
- `POST /api/admin/boloes/definitions/media` — upload logo
- `POST/PUT /api/admin/boloes/definitions` — persistência

---

## 14. Automação e cron

### Cron principal (dinâmico)

**Rota:** `GET|POST /api/cron/bolao-lifecycle`  
**Schedule:** `*/5 * * * *` em `vercel.json`  
**Auth:** `Authorization: Bearer ${CRON_SECRET}`

**Worker:** `lib/boloes/definitions/lifecycle-worker.ts` → `runBolaoLifecycleTick()`

Por cada definição `enabled`:
1. Computa lifecycle → atualiza DB se mudou + audit log
2. Se pronto para settlement → `processDefinitionPrizeClosure()`

Retorno: `{ scanned, updated, prizesProcessed, transitions[] }`

### Cron legado

Match sync dispara `processPrizeClosuresAfterMatchSync()` em `lib/prizes/processor.ts` — **exclui** tickets com `bolao_definition_id`.

---

## 15. Cache de partidas

### Fonte única

`fetchMatchesMap()` em `lib/football-api.ts` — lê/escreve `matches_cache`.

Usado por:
- Escopo de definições
- Lifecycle / ao vivo
- Ranking (pontuação ao vivo)
- Settlement (kickoffs e resultados)
- Palpites (placares)

### Live sync

Client polling chama `/api/partidas` com live sync (`partidasUrlWithLiveSync`) para atualizar placares antes de refresh de ranking.

### Mesmo sistema legado

Bolões legados e dinâmicos compartilham o mesmo cache — não há cache separado por definição; o escopo é calculado em runtime sobre o mapa global.

---

## 16. APIs relevantes

### Público / usuário autenticado

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/boloes/catalog` | Seções da loja (upcoming/available/closed) |
| GET | `/api/deposits/transactions` | Catálogo + preços para checkout |
| POST | `/api/deposits/transactions` | Criar PIX (`definitionsById`) |
| GET | `/api/ranking/bootstrap` | Escopos + board inicial |
| GET | `/api/ranking/board` | `mode=dynamic&definitionId=` \| principal \| diario \| extra |
| GET | `/api/ranking/scopes` | Lista de escopos do usuário |
| GET/POST | `/api/palpites` | Salvar palpite (validação de escopo) |
| GET | `/api/palpites/resumo` | Stats do usuário por ticket |
| GET | `/api/palpites/historico` | Histórico de palpites |
| GET | `/api/tickets/mine` | Cotas do usuário |
| GET | `/api/public/bolao-definition-media/[id]` | Logo/banner |

### Admin

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/boloes/hub` | Cards legado + dinâmico |
| GET | `/api/admin/boloes/ranking` | `type=definition&id=` |
| GET/POST | `/api/admin/boloes/definitions` | Listar / criar |
| GET/PUT/DELETE | `/api/admin/boloes/definitions/[id]` | CRUD |
| POST | `/api/admin/boloes/definitions/[id]/duplicate` | Duplicar |
| GET | `/api/admin/boloes/definitions/competitions` | Campeonatos |
| GET | `/api/admin/boloes/definitions/matches` | Partidas |
| POST | `/api/admin/boloes/definitions/media` | Upload mídia |

### Cron

| Método | Rota | Frequência |
|--------|------|------------|
| GET/POST | `/api/cron/bolao-lifecycle` | 5 min |

---

## 17. Variáveis de ambiente

| Variável | Default | Uso |
|----------|---------|-----|
| `PRIZE_DAILY_GRACE_AFTER_LAST_KICKOFF_MINUTES` | `180` | Grace após último jogo (diário/rodada) |
| `PRIZE_GENERAL_GRACE_HOURS_AFTER_LAST_KICKOFF` | `36` | Grace após último jogo (geral/copa inteira) |
| `CRON_SECRET` | — | Autorização do cron lifecycle |

Documentadas em `.env.example` e `.env.production.example`.

**Overrides por bolão (banco, não env):**
- `settlement_at` — datetime mínimo de apuração
- `prize_release_at` — datetime mínimo de crédito no saldo

---

## 18. Mapa de arquivos

### Core dinâmico (`lib/boloes/definitions/`)

| Arquivo | Responsabilidade |
|---------|------------------|
| `types.ts` | Tipos e interfaces |
| `schema.ts` | DDL bootstrap |
| `mapper.ts` | DB ↔ app |
| `repository.ts` | CRUD |
| `scope.ts` | Escopo de jogos |
| `lifecycle.ts` | Cálculo de status |
| `lifecycle-worker.ts` | Tick do cron |
| `lifecycle-labels.ts` | Labels PT |
| `settlement.ts` | Apuração + grace |
| `ranking.ts` | Ranking por definição |
| `prizes.ts` | Pool + awards |
| `prize-processor.ts` | Fechamento e crédito |
| `prize-released-ids.ts` | IDs já premiados |
| `catalog.ts` | Vitrine/loja |
| `purchase.ts` | Linhas de checkout |
| `stats.ts` | Estatísticas admin |
| `branding.ts` | Logo/nome enriquecido |
| `audit-log.ts` | Auditoria |
| `legacy-bolao.ts` | Detecção legado/sintético |

### Admin hub

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/admin/bolao-hub-items.ts` | Merge hub |
| `lib/admin/bolao-hub-legacy-items.ts` | Cards legados |
| `lib/admin/bolao-hub-logo.ts` | Logos |

### Ranking

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/ranking/scopes.ts` | Escopos server (incl. dynamic) |
| `lib/ranking/scopes-shared.ts` | Tipos client + helpers |
| `lib/ranking/load-board-client.ts` | Fetch client do board |
| `lib/ranking/leaderboard.ts` | `buildLeaderboardForDefinition` |

### Palpites

| Arquivo | Responsabilidade |
|---------|------------------|
| `app/(authenticated)/palpites/page.tsx` | SSR initial data |
| `app/(authenticated)/palpites/PalpitesClient.tsx` | UI client |
| `lib/boloes/palpites-jogos-filter.ts` | Filtro de jogos |
| `lib/palpites/ticket-meta.ts` | Meta da cota |
| `lib/palpites/validate-palpite-save.ts` | Validação save |
| `lib/boloes/ticket-match-scope.ts` | Escopo por ticket |

### Premiação legado

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/prizes/processor.ts` | Closures legado |
| `lib/prizes/distribution.ts` | Distribuição % |

### UI principal

| Arquivo | Responsabilidade |
|---------|------------------|
| `app/(authenticated)/boloes/page.tsx` | Vitrine + meus bolões |
| `app/(authenticated)/boloes/_components/DynamicBolaoCatalog.tsx` | Catálogo client |
| `app/(authenticated)/ranking/_components/RankingExperience.tsx` | Ranking user |
| `app/admin/(panel)/boloes/definicoes/_components/BolaoCreateWizard.tsx` | Wizard admin |

---

## 19. Fluxos ponta a ponta

### A. Admin cria e publica bolão

```
1. /admin/boloes/definicoes/novo
2. Wizard: nome → preço → jogos → datas/settlement/premiação → publicar
3. POST /api/admin/boloes/definitions
4. bolao_definitions row criada (lifecycle_status=programado)
5. sale_enabled + shop_visible=true → aparece em /api/boloes/catalog
```

### B. Usuário compra e palpita

```
1. /boloes → card → /tickets?definitionId={uuid}
2. POST checkout → ticket com bolao_definition_id
3. Pagamento → status=paid
4. /palpites?ticket={id} → jogos filtrados pelo escopo
5. POST /api/palpites → validatePalpiteForSave (escopo + lock)
```

### C. Ao vivo e ranking

```
1. Match sync atualiza matches_cache
2. Cron lifecycle (5min) → computeBolaoLifecycleStatus → ao_vivo
3. /ranking?default=def:{uuid} → GET board mode=dynamic
4. Client poll 12–45s refresh ranking + partidas live
```

### D. Apuração e premiação

```
1. Último jogo do escopo finaliza
2. now >= lastKickoff + grace (e settlement_at se definido)
3. Cron → isDefinitionReadyForSettlement → processDefinitionPrizeClosure
4. buildDefinitionRanking → calculateDefinitionPrizeAwards
5. creditAward → users.balance_cents
6. lifecycle_status = premiacao_liberada
```

---

## 20. Convivência legado × dinâmico

| Regra | Implementação |
|-------|---------------|
| Tickets legados não usam definição | `bolao_definition_id IS NULL` |
| Premiação legado ignora tickets dinâmicos | Filtro em `lib/prizes/processor.ts` |
| Hub admin mostra ambos | Merge em `bolao-hub-items.ts` |
| Cards legados sem editar | `isLegacy` em `AdminBolaoDefinitionCard` |
| Loja prioriza dinâmico se existir | `TicketCheckoutFlow` + `catalogBoloes` |
| Ranking escopos separados | Dynamic usa `mode=dynamic`; legado usa principal/diario/extra |
| Mesmo cache de partidas | `fetchMatchesMap()` compartilhado |

---

## 21. Limitações e pendências conhecidas

Itens **não implementados** ou parcialmente implementados (maio/2026):

| Item | Estado |
|------|--------|
| `scoringConfig` customizado na pontuação | Campo existe; pontuação usa fórmula Copa fixa |
| `maxTicketsPerUser` no checkout | Campo no wizard/DB; enforcement no checkout pendente |
| Notificações push de prêmio (dinâmico) | Pendente |
| Transição automática para `finalizado` (ranking publicado) | Parcial — status existe, fluxo automático limitado |
| Wizard: `ticketType` general/daily | Wizard fixa `extra` + `custom_matches` |
| UI wizard para scope_mode round/weekend/full | Apenas custom_matches no wizard atual |

---

## Glossário rápido

| Termo | Significado |
|-------|-------------|
| **Definição** | Registro em `bolao_definitions` — configuração do bolão |
| **Escopo** | Conjunto de partidas válidas para palpite/ranking/settlement |
| **Settlement** | Momento em que o bolão é apurado (ranking fechado) |
| **Grace** | Margem após último apito antes de apurar |
| **Closure** | Registro em `prize_closures` — fechamento de premiação |
| **Pool** | Valor total a distribuir (% da arrecadação) |
| **Tier** | Colocação premiada (1º, 2º, 3º...) |
| **Cota / ticket** | Ingresso comprado pelo usuário |
| **Legado** | Bolões hardcoded (Principal, Skale, etc.) |
| **Sintético** | Card admin sem row DB (ID `legacy:*` ou comp ≥ 90000) |

---

## Como uma IA deve usar este documento

1. **Entender o contexto:** ler §1–2 antes de qualquer alteração em prêmios ou ranking.
2. **Rastrear escopo:** quase todo comportamento dinâmico passa por `scopeMatchesForBolaoDefinition()` — comece por aí.
3. **Não misturar pipelines:** alterações em `lib/prizes/processor.ts` não afetam bolões dinâmicos (e vice-versa), exceto tabelas compartilhadas.
4. **Testar settlement:** simular `settlement_at`, último kickoff e env vars de grace.
5. **Verificar isolamento:** queries de tickets legado devem manter `bolao_definition_id IS NULL`.
6. **UI client vs server:** escopos/ranking board são server (`scopes.ts`); URLs client em `load-board-client.ts` e `RankingExperience.tsx`.

Para explorar o código, busque por: `bolao_definition_id`, `scopeMatchesForBolaoDefinition`, `processDefinitionPrizeClosure`, `mode=dynamic`, `buildAdminBolaoHubItems`.
