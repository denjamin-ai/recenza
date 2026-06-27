#!/usr/bin/env bash
# Ждёт готовности тест-сервера. Использование: bash healthcheck.sh [timeout=60] [url=http://localhost:3001]
# Код выхода 0 — сервер ответил; 1 — таймаут (запусти: npm run dev:test).
set -euo pipefail
TIMEOUT="${1:-60}"
URL="${2:-http://localhost:3001}"

echo "[healthcheck] жду $URL (до ${TIMEOUT}s)…"
for ((i = 1; i <= TIMEOUT; i++)); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$URL" || true)"
  if [[ "$code" =~ ^(200|301|302|307|308)$ ]]; then
    echo "[healthcheck] OK ($code) за ${i}s"
    exit 0
  fi
  sleep 1
done

echo "[healthcheck] таймаут: сервер не ответил за ${TIMEOUT}s. Запусти: npm run dev:test" >&2
exit 1
