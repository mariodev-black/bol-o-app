#!/usr/bin/env bash
# Bolão dos Artilheiros — setup no servidor (schema + catálogo do JSON)
#
# Uso no servidor (na pasta do projeto, ex. /var/www/bol-o-app):
#   sudo bash scripts/setup-artilheiros-bolao.sh
#
# Requer: Node.js, npm, .env com DATABASE_* ou DATABASE_URL

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "=== Bolão dos Artilheiros — setup servidor ==="
echo "Diretório: $APP_DIR"

if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "[ERRO] Arquivo .env não encontrado em $APP_DIR"
  echo "       Copie .env.example para .env e configure DATABASE_HOST / DATABASE_URL"
  exit 1
fi

if [[ ! -f "$APP_DIR/app/shared/elencos-copa-2026.json" ]]; then
  echo "[ERRO] elencos-copa-2026.json ausente em app/shared/"
  exit 1
fi

# Carrega variáveis do .env (DATABASE_HOST, DATABASE_URL, etc.)
set -a
# shellcheck disable=SC1091
source "$APP_DIR/.env"
set +a

if [[ -z "${DATABASE_URL:-}" && -z "${DATABASE_HOST:-}" ]]; then
  echo "[ERRO] Configure DATABASE_URL ou DATABASE_HOST no .env"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERRO] Node.js não encontrado no PATH"
  exit 1
fi

if [[ ! -d "$APP_DIR/node_modules" ]]; then
  echo "[INFO] Instalando dependências (npm ci)..."
  npm ci --omit=dev 2>/dev/null || npm install --omit=dev
fi

echo "[INFO] Validando estrutura do elencos-copa-2026.json..."
npx tsx --tsconfig tsconfig.scripts.json scripts/verify-elencos-copa-2026.ts

echo "[INFO] Aplicando migração + sincronizando catálogo no PostgreSQL..."
npx tsx --tsconfig tsconfig.scripts.json scripts/run-artilheiros-bolao-migration.ts

echo ""
echo "=== Setup concluído ==="
echo "Próximos passos:"
echo "  1. Garanta TICKETS_ARTILHEIROS_ENABLED=true no .env"
echo "  2. Reinicie a aplicação (pm2/systemd)"
echo "  3. Teste: /tickets?bolao=artilheiros e /palpites/artilheiros"
