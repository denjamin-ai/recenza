#!/usr/bin/env bash
# Очистка тест-данных. Рекомендация: для детерминированного состояния используй reset-test-db.sh
# (быстрее и надёжнее, чем точечное удаление). Этот скрипт — обёртка с безопасным dry-run.
#   DB_PATH=blog.test.db bash cleanup-test-data.sh --dry-run   # показать счётчики, ничего не трогать
#   DB_PATH=blog.test.db bash cleanup-test-data.sh             # полный сброс через reset-test-db.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DB_PATH="${DB_PATH:-blog.test.db}"

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "[cleanup] dry-run: текущее число строк в основных таблицах (DB_PATH=$DB_PATH):"
  # Список таблиц СТАТИЧЕН (нет недоверенного ввода) — интерполяция $t в SQL безопасна.
  for t in users blogs chapters chapter_revisions public_comments notifications; do
    bash "$DIR/db-query.sh" sql "SELECT '$t' AS tbl, count(*) AS n FROM $t;" || true
  done
  echo "[cleanup] для полного сброса к детерминированному снимку: bash \"$DIR/reset-test-db.sh\""
  exit 0
fi

echo "[cleanup] полный детерминированный сброс через reset-test-db.sh…"
bash "$DIR/reset-test-db.sh"
