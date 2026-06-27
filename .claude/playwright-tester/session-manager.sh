#!/usr/bin/env bash
# Управление несколькими сессиями одновременно (обёртка над login.sh).
#   bash session-manager.sh init reader password author password   # вход парами role/password
#   bash session-manager.sh status                                  # список активных cookie-файлов
#   bash session-manager.sh logout-all                              # удалить все cookie-файлы
# Для admin передавай его пароль: ... admin "$ADMIN_PASSWORD_PLAIN"
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CMD="${1:?usage: session-manager.sh init|status|logout-all}"
shift || true

case "$CMD" in
  init)
    [[ $# -ge 2 ]] || { echo "usage: session-manager.sh init <role> <password> [...]" >&2; exit 1; }
    while [[ $# -ge 2 ]]; do
      role="$1"; password="$2"; shift 2
      bash "$DIR/login.sh" "$role" "$password" || echo "[session] $role: вход не удался"
    done
    ;;
  status)
    shopt -s nullglob
    found=0
    for f in /tmp/*_cookies.txt; do
      echo "[session] активна: $(basename "$f")"
      found=1
    done
    [[ "$found" == 0 ]] && echo "[session] активных сессий нет"
    ;;
  logout-all)
    rm -f /tmp/*_cookies.txt
    echo "[session] все cookie-файлы удалены"
    ;;
  *)
    echo "usage: session-manager.sh init|status|logout-all" >&2
    exit 1
    ;;
esac
