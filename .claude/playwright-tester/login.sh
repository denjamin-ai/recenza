#!/usr/bin/env bash
# Логин роли + сохранение cookies в /tmp/<role>_cookies.txt.
#   admin                       → POST /api/auth        body {password}
#   reader | author | reviewer  → POST /api/auth/user   body {handle, password}
# Использование:
#   BASE_URL=http://localhost:3001 bash login.sh reader password
#   BASE_URL=http://localhost:3001 bash login.sh admin "$ADMIN_PASSWORD_PLAIN"
# Коды выхода: 0 ок · 1 ошибка/неверные данные/нет соединения · 2 rate-limit (429).
# ⚠️ Эндпоинты auth появляются в Фазе 4; форма тела {handle,password} провизорная до Фазы 4.
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:3001}"
ROLE="${1:?usage: login.sh <role> <password>}"
PASSWORD="${2:?usage: login.sh <role> <password>}"
COOKIE="/tmp/${ROLE}_cookies.txt"
RESP="/tmp/${ROLE}_login_resp.json"

# JSON-экранирование без зависимости от jq: экранируем '\' и '"' (иначе пароль со спецсимволами
# ломает тело запроса). Если в harness появится jq — предпочтительно: jq -n --arg p "$PASSWORD" …
json_escape() { local s="$1"; s="${s//\\/\\\\}"; s="${s//\"/\\\"}"; printf '%s' "$s"; }
PW_ESC="$(json_escape "$PASSWORD")"
ROLE_ESC="$(json_escape "$ROLE")"

if [[ "$ROLE" == "admin" ]]; then
  ENDPOINT="$BASE_URL/api/auth"
  BODY="{\"password\":\"$PW_ESC\"}"
else
  ENDPOINT="$BASE_URL/api/auth/user"
  BODY="{\"handle\":\"$ROLE_ESC\",\"password\":\"$PW_ESC\"}"
fi

code="$(curl -s -o "$RESP" -w '%{http_code}' \
  -c "$COOKIE" \
  -H 'Content-Type: application/json' \
  -H "Origin: $BASE_URL" \
  -X POST "$ENDPOINT" -d "$BODY" || true)"

case "$code" in
  200 | 201 | 204) echo "[login] $ROLE → OK ($code); cookies: $COOKIE" ;;
  429) echo "[login] $ROLE → rate-limit (429). Подожди 15 мин." >&2; exit 2 ;;
  000) echo "[login] нет соединения с $ENDPOINT (сервер поднят? npm run dev:test)." >&2; exit 1 ;;
  *) echo "[login] $ROLE → провал ($code): $(cat "$RESP" 2>/dev/null || true)" >&2; exit 1 ;;
esac
