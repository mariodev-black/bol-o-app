#!/usr/bin/env bash
# Deploy disparado pelo webhook GitHub: entra na pasta do app, pull, build, pm2.
# No servidor defina DEPLOY_APP_ROOT=/root/app (ou ~/app) — é onde está o clone e o .git.

set -euo pipefail

if [[ -n "${DEPLOY_APP_ROOT:-}" ]]; then
  ROOT="${DEPLOY_APP_ROOT}"
  if [[ "$ROOT" == "~" ]]; then
    ROOT="$HOME"
  elif [[ "$ROOT" == "~/"* ]]; then
    ROOT="$HOME/${ROOT:2}"
  fi
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

cd "$ROOT" || { echo "ERRO: não foi possível cd em $ROOT"; exit 1; }

LOG="${DEPLOY_LOG_FILE:-$ROOT/logs/github-deploy.log}"
mkdir -p "$(dirname "$LOG")"

exec >>"$LOG" 2>&1

echo "==== $(date -u '+%Y-%m-%dT%H:%M:%SZ') deploy start (pid $$) pid=$$ ===="

BRANCH="${GITHUB_DEPLOY_BRANCH:-main}"
export NODE_ENV="${NODE_ENV:-production}"

if [[ "${SKIP_GIT_PULL:-0}" != "1" ]]; then
  echo "git fetch origin ${BRANCH} ..."
  git fetch origin "$BRANCH"
  echo "git reset --hard origin/${BRANCH} ..."
  git reset --hard "origin/${BRANCH}"
else
  echo "SKIP_GIT_PULL=1 — pulando git"
fi

echo "npm ci ..."
npm ci

echo "npm run build ..."
npm run build

echo "pm2 restart all ..."
pm2 restart all

echo "==== deploy finished OK ===="
