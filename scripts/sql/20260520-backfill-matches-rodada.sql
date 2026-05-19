-- =======================================================================
-- Backfill de `matches_cache.rodada` a partir de `round_key`.
--
-- Antes da v2 o sync salvava só `round_key` (ex.: "17a-rodada"). A v2
-- introduziu a coluna numerica `rodada`, mas os jogos antigos ficaram com
-- `rodada IS NULL`. O parser do cliente preferia o indice ordinal das
-- chaves do objeto de fases — que está OFF-BY-ONE quando as rodadas vêm
-- desordenadas (ex.: "1a-rodada", "2a-rodada", ..., "16a-rodada",
-- "18a-rodada", "19a-rodada", ... "17a-rodada").
--
-- Esta migration é IDEMPOTENTE: só popula linhas com `rodada IS NULL`
-- e cujo `round_key` casa com o padrao "Na-rodada" / "N-rodada" / "rodada-N".
--
-- Rodar:  psql "$DATABASE_URL" -f scripts/sql/20260520-backfill-matches-rodada.sql
-- =======================================================================

BEGIN;

UPDATE matches_cache
SET rodada = (regexp_match(round_key, '(\d+)'))[1]::int
WHERE rodada IS NULL
  AND round_key IS NOT NULL
  AND round_key ~ '\d';

COMMIT;
