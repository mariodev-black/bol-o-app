#!/usr/bin/env bash
set -euo pipefail
: "${APP_URL:=http://127.0.0.1:3000}"
: "${CRON_SECRET:?defina CRON_SECRET}"
curl -fsS "${APP_URL}/api/cron/sync-partidas?secret=${CRON_SECRET}" >/dev/null
