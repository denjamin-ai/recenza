#!/usr/bin/env bash
# Read-only выборка из тест-БД без знания SQL (обёртка над db-helper.ts на @libsql/client).
# Использование (DB_PATH по умолчанию blog.test.db):
#   DB_PATH=blog.test.db bash db-query.sh blogs
#   DB_PATH=blog.test.db bash db-query.sh user reviewer
#   DB_PATH=blog.test.db bash db-query.sh sql "SELECT count(*) FROM chapters;"
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
cd "$ROOT"
export DB_PATH="${DB_PATH:-blog.test.db}"

if [[ -x "$ROOT/node_modules/.bin/tsx" ]]; then
  TSX=("$ROOT/node_modules/.bin/tsx")
else
  TSX=(npx tsx)
fi

"${TSX[@]}" "$DIR/db-helper.ts" "$@"
