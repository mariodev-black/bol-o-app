#!/usr/bin/env bash
# Deploy disparado pelo webhook GitHub: pasta do app → git pull → npm install só se precisar → build → pm2.
# npm install roda se: node_modules não existe, package.json/lock mudou no pull, ou FORCE_NPM_INSTALL=1.
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

trap 'echo "[deploy-flow] ERRO bash: exit=$? linha=$LINENO (comando provavelmente acima)"' ERR

echo "==== $(date -u '+%Y-%m-%dT%H:%M:%SZ') [deploy-flow] script iniciado | pid=$$ | ROOT=$ROOT | LOG=$LOG ===="
echo "[deploy-flow] Lembrete: o GitHub só chama este script após **git push** (commit só local não dispara webhook)."

BRANCH="${GITHUB_DEPLOY_BRANCH:-main}"
export NODE_ENV="${NODE_ENV:-production}"

# “Impressão digital” de package.json + package-lock.json (só roda npm install se mudar ou não houver node_modules).
deps_fingerprint() {
  if [[ -f package-lock.json ]]; then
    cat package.json package-lock.json | md5sum | awk '{print $1}'
  else
    md5sum package.json | awk '{print $1}'
  fi
}

DEPS_BEFORE="$(deps_fingerprint)"
echo "[deploy-flow] fingerprint deps (antes do git): ${DEPS_BEFORE}"

if [[ "${SKIP_GIT_PULL:-0}" != "1" ]]; then
  echo "[deploy-flow] etapa: git checkout ${BRANCH}"
  git checkout "$BRANCH"
  echo "[deploy-flow] etapa: git pull origin ${BRANCH}"
  git pull origin "$BRANCH"
else
  echo "[deploy-flow] SKIP_GIT_PULL=1 — pulando git"
fi

DEPS_AFTER="$(deps_fingerprint)"
echo "[deploy-flow] fingerprint deps (depois do git): ${DEPS_AFTER}"

if [[ "${FORCE_NPM_INSTALL:-0}" == "1" ]]; then
  echo "[deploy-flow] etapa: npm install (FORCE_NPM_INSTALL=1)"
  npm install --no-audit --no-fund
elif [[ ! -d node_modules ]]; then
  echo "[deploy-flow] etapa: npm install (node_modules ausente)"
  npm install --no-audit --no-fund
elif [[ "$DEPS_BEFORE" != "$DEPS_AFTER" ]]; then
  echo "[deploy-flow] etapa: npm install (package.json ou lock mudou)"
  npm install --no-audit --no-fund
else
  echo "[deploy-flow] etapa: npm install — PULADO (deps inalteradas)"
fi

echo "[deploy-flow] etapa: npm run build"
npm run build

echo "[deploy-flow] etapa: pm2 restart all"
pm2 restart all

echo "==== $(date -u '+%Y-%m-%dT%H:%M:%SZ') [deploy-flow] script terminou OK ===="
