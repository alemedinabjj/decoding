#!/usr/bin/env bash
# Envia uma pergunta à Iris (servidor local) e imprime a resposta em texto.
# Uso: scripts/ask-iris.sh "Qual o valor total das oportunidades abertas?"
set -euo pipefail
URL="${IRIS_URL:-http://localhost:3000/api/chat}"
# Opcional: IRIS_FILTERS='{"startDate":"2025-11-01"}' simula a pergunta feita pelo painel do dashboard.
BODY=$(node -e 'const f=process.env.IRIS_FILTERS; console.log(JSON.stringify({messages:[{role:"user",content:process.argv[1]}], ...(f ? {dashboardFilters: JSON.parse(f)} : {})}))' "$1")
curl -sN "$URL" -H 'Content-Type: application/json' -d "$BODY" | node -e '
let buf = "";
process.stdin.on("data", (c) => (buf += c));
process.stdin.on("end", () => {
  for (const block of buf.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data:"));
    if (!line) continue;
    const event = JSON.parse(line.slice(5));
    if (event.type === "status") process.stdout.write(`[${event.label}]\n`);
    if (event.type === "delta") process.stdout.write(event.text);
    if (event.type === "error") process.stdout.write(`\n[erro] ${event.message}`);
  }
  process.stdout.write("\n");
});'
