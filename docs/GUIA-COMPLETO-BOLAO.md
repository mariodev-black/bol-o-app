# Guia completo — dados, crons, telas, pontuação e premiação

Este documento descreve **como o Bolão do Milhão funciona por baixo dos panos**: de onde vêm os dados de partidas e tabela, **quando** a API Futebol é chamada (só fora do fluxo do browser), crons, premiação e pontos.

---

## 1. Regra de ouro: front e rotas `/api/*` públicas ao cliente

- **Navegador / app (fetch do cliente)** chama rotas como `GET /api/partidas` e `GET /api/tabela`.
- Essas rotas leem **apenas o PostgreSQL**:
  - Partidas: tabela **`matches_cache`**
  - Tabela do campeonato + enriquecimento de fases: tabela **`football_api_cache`**
- **Nenhuma** dessas rotas dispara a API `api.api-futebol.com.br` só porque o usuário abriu uma tela.
- O servidor **enche** essas tabelas por:
  1. **Warmup** ao subir o processo (`instrumentation` → `lib/cron/bootstrap.ts`)
  2. **Tick interno** a cada N segundos (default 300 = 5 min)
  3. **Crons HTTP** autenticados com `CRON_SECRET` (ou header Vercel Cron)
  4. **Após salvar palpite**: uma chamada leve só para **atualizar a tabela** (`lib/football-standings-refresh.ts`)

Arquivos-chave:

| Destino | Arquivo |
|--------|---------|
| GET partidas (só DB) | `app/api/partidas/route.ts` |
| GET tabela (só DB) | `app/api/tabela/route.ts` |
| Mapa de partidas no servidor (SSR/API internas) | `lib/football-api.ts` → `fetchMatchesMap()` |
| Sync com a API (partidas) | `lib/matches-cache.ts` → `syncMatchesCache` + `lib/football-api.ts` → `fetchProviderMatches` |
| Tick de manutenção | `lib/cron/maintenance-tick.ts` |
| Sync condicional (só se “pendente”) | `lib/cron/tasks/conditionalMatchesSyncTask.ts` |
| Regras “precisa puxar API agora?” | `lib/cron/match-result-guarantee.ts` |

---

## 2. Scheduler interno (cron a cada 5 minutos)

### 2.1 Como liga

- Arquivo `instrumentation.ts` importa `startInternalCronScheduler()` de `lib/cron/bootstrap.ts` quando o runtime Node do Next sobe.
- Variáveis: `INTERNAL_CRON_ENABLED`, `INTERNAL_CRON_TICK_SECONDS` (default 300), `INTERNAL_CRON_RUN_ON_VERCEL` (em Vercel o interno costuma ficar desligado salvo exceção).

### 2.2 O que roda no warmup (primeira subida)

Ordem em `bootstrap.ts` (fire-and-forget):

1. `runFootballSnapshotsIfCacheMissing()` — se não existir cache de tabela/fases, **uma** sequência na API grava `football_api_cache`.
2. `runSyncMatchesTask(true)` — força `syncMatchesCache` e preenche `matches_cache`.
3. `runGuaranteeResultsTask()` — garantia de placar + processamento de prêmios (ver §6).

### 2.3 O que roda a cada tick (`runMaintenanceTick`)

Ordem em `lib/cron/maintenance-tick.ts`:

1. **`maybeRunFootballDailySnapshot()`** (`lib/cron/tasks/footballSnapshotsTask.ts`)  
   - Se estiver na **janela noturna BRT** (00:00–00:15 ou 01:00–01:15) e ainda não rodou hoje:  
     - Baixa **tabela + todas as fases** (snapshot) → `football_api_cache`  
     - Em seguida **`syncMatchesCache` forçado** (partidas) → `matches_cache`  
   - Nesse ciclo, o passo (2) abaixo é **pulado** para não duplicar sync.

2. **`runConditionalMatchesApiSync()`** (`lib/cron/tasks/conditionalMatchesSyncTask.ts`)  
   - Chama a API **somente se** `needsMatchApiRefreshForCron()` for verdadeiro (`lib/cron/match-result-guarantee.ts`):
     - **`needsForcedResultSync()`**: placar obrigatório atrasado (palpite + apito há X horas sem placar; ou relógio “fim de jogo”; ou status encerrado/finalizado sem gols na cache).
     - **`needsStaleMatchCacheForApiSync()`**: partida **já iniciada**, linha em `matches_cache` com `synced_at` mais velha que `MATCH_CRON_STALE_REFRESH_MINUTES` (default 25), e (**há palpite** na partida **ou** status indica ao vivo/intervalo/em andamento), e não é cancelado/adiado com placar completo já resolvido.
   - Se **nenhuma** condição: retorna `reason: "cron-sem-pendencias-api"` e **não** gasta requisição de partidas.

3. **`runGuaranteeResultsTask()`** (`lib/cron/tasks/guaranteeResultsTask.ts`)  
   - Se ainda precisar de sync forçado por garantia, pode rodar `syncMatchesCache` de novo.  
   - Sempre roda `processPrizeClosuresAfterMatchSync()` (idempotente).

### 2.4 Crons HTTP (mesmo servidor, chamada externa)

| Rota | Função |
|------|--------|
| `GET /api/cron/tick` | Um ciclo completo = mesmo que o scheduler interno (`runMaintenanceTick`). |
| `GET /api/cron/sync-partidas` | `runSyncMatchesTask(true)` — operador força atualização de partidas. |
| `GET /api/cron/football-snapshots` | Snapshot tabela+fases + `syncMatchesCache` forçado (alinhado ao pipeline noturno). |
| `GET /api/cron/garantia-resultados` | Apenas `runGuaranteeResultsTask()` (sync forçado se regra de garantia + prêmios). |

Autorização: `CRON_SECRET` (query `?secret=` ou `Authorization: Bearer`), ou header `x-vercel-cron: 1`.

---

## 3. Fluxo da API Futebol (só servidor)

- **`fetchProviderMatches`**: principalmente `GET /v1/campeonatos/{id}/partidas`, depois merge (enriquecimento com snapshot em `football_api_cache` para fases; rodadas na API só se `FOOTBALL_ROUNDS_LIVE_ENRICH=true`).
- **`downloadStandingsJson` / `downloadFasesEnrichmentMatches`**: usados no job de snapshot (`lib/football-external-downloads.ts`).
- **`syncMatchesCache`**: grava/atualiza `matches_cache` e dispara `processPrizeClosuresAfterMatchSync` após escrita (ver `lib/matches-cache.ts`).

### 3.1 `matches_cache` e “fresco”

- `scheduleSaysFresh()` ainda é usada **dentro** de `syncMatchesCache` quando `force: false` (evita rajadas).  
- Se existir jogo **em andamento / ao vivo / intervalo** na cache, a lógica trata como situação em que o **sync leve** não deve pressionar a API (detalhes em `lib/matches-cache.ts`).

---

## 4. Pontuação dos palpites

Implementação: **`lib/predictions.ts`** → `calcPredictionPoints(predCasa, predVisit, realCasa, realVisit)`.

| Situação | Pontos |
|----------|--------|
| Placar exato | **6** |
| Resultado (vitória/empate/derrota) acertado, com pelo menos um gol do placar certo | **4** |
| Resultado acertado, nenhum gol exato | **3** |
| Só gols isolados certos (sem acertar o resultado) | **0–2** (1 ponto por gol do placar certo) |

O ranking e o resumo usam o mesmo critério ao comparar palpite com `result_casa` / `result_visitante` da partida (vindos da `matches_cache`).

---

## 5. Premiação (pool, fechamento, crédito)

### 5.1 Onde está o código

- **Distribuição e % do pool**: `lib/prizes/distribution.ts` — pool efetivo **60%** da arrecadação (`PRIZE_POOL_BPS`), faixas de ranking para bolão geral e pesos do bolão diário.
- **Processamento idempotente** (fechar bolão, calcular ranking, gerar transações, creditar saldo): `lib/prizes/processor.ts`.
- **Disparo após sync de partidas**: `lib/matches-cache.ts` chama `processPrizeClosuresAfterMatchSync` ao final de um `syncMatchesCache` bem-sucedido.

### 5.2 Regra de “partida resolvida”

Em `processor.ts`, partida conta como resolvida para premiação se há **placar oficial** (mandante e visitante) **ou** status de cancelamento/adiamento/suspensão/interrupção que dispensa placar numérico.

### 5.3 Bolão diário x geral

- Tipos `general` / `daily` nos tickets e fechamentos distintos (gates de tempo após último apito do dia, etc. — ver envs `PRIZE_DAILY_*` no `.env.example` e comentários em `processor.ts`).

---

## 6. Telas (App Router) — o que costuma ler

Visão prática: **UI** → **Route Handlers** ou **Server Components** → **Postgres** (e às vezes APIs de **pagamento**, não confundir com API Futebol).

| Área | Rota / pasta | Dados principais |
|------|----------------|------------------|
| Home | `app/page.tsx` | Marketing; pode usar `fetch("/api/partidas")` — só DB |
| Login / cadastro | `app/(auth)/` | Auth, sem Futebol |
| Dashboard | `(authenticated)/dashboard/` | Resumo interno |
| Bolões / Meus bolões | `(authenticated)/boloes/` | Tickets, `fetchMatchesMap` no servidor = só `matches_cache` |
| Palpites | `(authenticated)/palpites/` | `PalpitesClient` → `GET /api/partidas`, `GET /api/tabela`, `POST /api/palpites` |
| Meus palpites | `meus-palpites/` | Histórico / links |
| Ranking | `ranking/` | APIs de palpites + `fetchMatchesMap` |
| Premiação | `premiacao/` | Copy + dados do produto |
| Perfil / depósito / saques / tickets | pastas homônimas | Usuário, pagamentos |
| Admin | `app/admin/` | Painel separado |

**`POST /api/palpites`**: valida regras de prazo com `fetchMatchesMap()` (só DB); após salvar, dispara em background `refreshStandingsFromApiOnce()` (**1** GET de tabela na API, para manter classificação alinhada sem abrir sync completo no GET).

---

## 7. Passo a passo — primeira subida com dados de jogo

1. Aplicar SQL base do projeto + **`scripts/sql/add-football-api-cache.sql`** (tabela `football_api_cache`).
2. Definir `FOOTBALL_API_TOKEN`, `FOOTBALL_COMPETITION_ID`, `DATABASE_URL`, `CRON_SECRET`.
3. Subir o servidor: o **warmup** tenta snapshot frio + sync de partidas.
4. Se a tabela continuar vazia, chamar manualmente:  
   `GET /api/cron/football-snapshots?secret=SEU_CRON_SECRET`
5. Opcional em produção sem processo sempre ligado: agendar **curl** periódico para `/api/cron/tick` ou `/api/cron/football-snapshots` + confiar no host para manter o Node vivo.

---

## 8. Variáveis de ambiente relacionadas (resumo)

Ver também **`.env.example`** (fonte completa).

- **Futebol**: `FOOTBALL_API_TOKEN`, `FOOTBALL_COMPETITION_ID`, `FOOTBALL_ROUNDS_LIVE_ENRICH`, `FOOTBALL_PARTIDA_DETAIL_LOOKUP_LIMIT`, …
- **Cron / cache de partidas**: `INTERNAL_CRON_TICK_SECONDS`, `MATCHES_CACHE_*`, `MATCH_CRON_STALE_REFRESH_MINUTES`, `MATCH_RESULT_GUARANTEE_HOURS_AFTER_KICKOFF`, `MATCH_END_CLOCK_AFTER_KICKOFF_MINUTES`
- **Prêmios**: `PRIZE_DAILY_GRACE_*`, etc.

---

## 9. Manutenção deste guia

Quando mudar regras de sync, janela noturna ou premiação, atualize:

- Este arquivo (`docs/GUIA-COMPLETO-BOLAO.md`)
- Comentários nos arquivos citados
- `README.md` na raiz (link e resumo)

---

## 10. Telas — detalhe por área

### 10.1 Pública (`app/page.tsx`)

Landing: marketing, CTAs. Se usar `fetch("/api/partidas")`, a resposta vem **só** de `matches_cache` (pode estar vazia até o primeiro cron/warmup).

### 10.2 Autenticação (`app/(auth)/`)

Login, cadastro, recuperar senha: **AuthContext**, cookies/sessão conforme implementação atual. Sem API Futebol.

### 10.3 Área logada — layout comum

Grupo `(authenticated)/`: header, navegação inferior. Dados de partidas para regras de negócio vêm de `fetchMatchesMap()` no **servidor** (leitura de `matches_cache`).

### 10.4 Bolões (`boloes/page.tsx`, `boloes/tickets/`)

Lista cotas/tickets do usuário; links para palpites. Usa `fetchMatchesMap` no servidor para datas “jogáveis” do bolão do dia, etc.

### 10.5 Palpites (`palpites/page.tsx` + `PalpitesClient.tsx`)

- **SSR** (`page.tsx`): pode buscar `/api/tabela` e `fetchMatchesMap` para estado inicial.
- **Cliente**: polling ou refresh de `GET /api/partidas` e `GET /api/tabela` — ambos **só banco**.
- **Salvar**: `POST /api/palpites` valida prazos com `fetchMatchesMap` (DB); após sucesso, **background**: `refreshStandingsFromApiOnce()` (1× tabela na API).

### 10.6 Meus palpites (`meus-palpites/`)

Histórico / resumo visual; APIs de palpites + mapa de partidas (DB).

### 10.7 Ranking (`ranking/page.tsx`)

Chama APIs em `app/api/palpites/*` e usa `fetchMatchesMap` para cruzar placar oficial com palpites.

### 10.8 Premiação (`premiacao/page.tsx`)

Texto e regras do produto (pool dinâmico, etc.). Valores creditados vêm do fluxo em `lib/prizes/processor.ts`.

### 10.9 Perfil, depósito, saques, indique, privacidade

Sem API Futebol; foco em usuário, pagamentos e afiliados.

### 10.10 Admin (`app/admin/`)

Login admin, 2FA, painel. Rotas `/api/admin/*` e crons operacionais são **separadas** do fluxo do bolão público.

---

*Última revisão alinhada ao modelo: rotas de partidas/tabela servidas só do banco; API Futebol concentrada em cron, warmup, operador e palpite→tabela.*
