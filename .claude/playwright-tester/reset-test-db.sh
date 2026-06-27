#!/usr/bin/env bash
# Сброс тест-БД (blog.test.db) к детерминированному снимку.
#   bash reset-test-db.sh            # миграции + seed (полный сброс)
#   bash reset-test-db.sh --no-seed  # только миграции
# Все команды идут через npm-скрипты (dotenv -e .env.test) — тест-стенд изолирован от dev.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--no-seed" ]]; then
  echo "[reset] только миграции тест-БД…"
  npm run db:migrate:test
else
  echo "[reset] миграции + детерминированный seed тест-БД…"
  npm run test:reset
fi
echo "[reset] готово."
