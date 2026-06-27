#!/usr/bin/env bash
# Быстрая проверка HTTP-статуса эндпоинта.
# Использование:
#   BASE_URL=http://localhost:3001 bash api-check.sh GET /api/blogs 200
#   BASE_URL=http://localhost:3001 bash api-check.sh GET /api/auth/user 200 /tmp/reader_cookies.txt
# Код выхода 0 — статус совпал; 1 — нет.
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3001}"
METHOD="${1:?usage: api-check.sh <METHOD> <path> <expected> [cookieFile]}"
PATHQ="${2:?usage: api-check.sh <METHOD> <path> <expected> [cookieFile]}"
EXPECTED="${3:?usage: api-check.sh <METHOD> <path> <expected> [cookieFile]}"
COOKIE="${4:-}"

ARGS=(-s -o /dev/null -w '%{http_code}' --max-time 10 -X "$METHOD" -H "Origin: $BASE_URL")
[[ -n "$COOKIE" ]] && ARGS+=(-b "$COOKIE")

code="$(curl "${ARGS[@]}" "$BASE_URL$PATHQ" || true)"
if [[ "$code" == "$EXPECTED" ]]; then
  echo "[api-check] $METHOD $PATHQ → $code (ожидалось $EXPECTED) ✓"
else
  echo "[api-check] $METHOD $PATHQ → $code (ожидалось $EXPECTED) ✗" >&2
  exit 1
fi
