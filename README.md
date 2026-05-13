# Bolão do Milhão

Aplicação web do **Bolão do Milhão**: bolão de futebol com **palpites**, **bolões**, **ranking**, **partidas**, **tabela** e fluxos de **conta** (perfil, indicação, depósitos, saques, tickets). Stack: **Next.js (App Router)**, React, Tailwind, TypeScript.

## Documentação operacional (leia primeiro)

**[docs/GUIA-COMPLETO-BOLAO.md](docs/GUIA-COMPLETO-BOLAO.md)** — passo a passo de:

- Onde ficam os dados (**PostgreSQL**: `matches_cache`, `football_api_cache`, palpites, tickets, prêmios)
- Por que **`GET /api/partidas` e `GET /api/tabela` não chamam a API Futebol** (só leem o banco)
- **Cron interno** (warmup + tick a cada 5 min), **condições** para gastar cota na API de partidas
- **Crons HTTP** (`/api/cron/tick`, `sync-partidas`, `football-snapshots`, garantia)
- **Pontuação** (`calcPredictionPoints`) e **premiação** (processor + distribution)

## Scripts

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # build de produção
npm run start    # servidor após build
npm run lint     # ESLint
```

## Estrutura de pastas (resumo)

- `app/` — rotas, layouts, API Route Handlers em `app/api/`
- `lib/` — lógica de negócio (DB, futebol, crons, prêmios, palpites)
- `scripts/sql/` — migrações / DDL auxiliar (ex.: `add-football-api-cache.sql`)
- `instrumentation.ts` — sobe o **scheduler interno** no Node

## Variáveis de ambiente

Ver **`.env.example`**: `DATABASE_URL`, `FOOTBALL_API_TOKEN`, `FOOTBALL_COMPETITION_ID`, `CRON_SECRET`, intervalos de cache e de cron (`INTERNAL_CRON_TICK_SECONDS`, `MATCH_CRON_STALE_REFRESH_MINUTES`, etc.).

## Requisitos

Node.js compatível com a versão de Next.js do `package.json` (recomendado: LTS atual).

---

Atualize o guia em `docs/` quando mudar regras de dados, cron ou premiação.
