#!/usr/bin/env bash
# Configura as variáveis de produção na Vercel a partir de um arquivo local (não versionado).
# Uso: scripts/vercel-env.sh .env.production.local
set -euo pipefail
FILE="${1:?informe o arquivo de variáveis}"
SENSITIVE="DATABASE_URL DATABASE_URL_READONLY OPENAI_API_KEY"

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"; value="${value#\"}"
  flags=""
  [[ " $SENSITIVE " == *" $key "* ]] && flags="--sensitive"
  vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$key" production $flags >/dev/null
  echo "✓ $key"
done < "$FILE"
