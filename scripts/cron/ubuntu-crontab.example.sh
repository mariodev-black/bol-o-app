#!/usr/bin/env bash
# Exemplo de cron no Ubuntu (ajuste APP_URL e CRON_SECRET).
# Instalacao: crontab -e e cole as linhas do final deste arquivo (sem o shebang duplicado).

set -euo pipefail

: "${APP_URL:=http://127.0.0.1:3000}"
: "${CRON_SECRET:?defina CRON_SECRET no ambiente ou exporte antes de rodar}"

curl -fsS "${APP_URL}/api/cron/sync-partidas?secret=${CRON_SECRET}" >/dev/null
curl -fsS "${APP_URL}/api/cron/garantia-resultados?secret=${CRON_SECRET}" >/dev/null

# --- Sugestao de crontab (rodar como usuario que tem rede ao app) ---
# Sync geral da competicao (ex.: a cada 6h); garantia a cada 15 min (so forca API se o DB detectar atraso).
# 0 */6 * * * APP_URL=https://seu-dominio CRON_SECRET=xxx /opt/bolao/scripts/cron/sync-partidas-only.sh
# */15 * * * * APP_URL=https://seu-dominio CRON_SECRET=xxx /opt/bolao/scripts/cron/garantia-only.sh
