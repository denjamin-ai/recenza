#!/usr/bin/env bash
# Ночной бэкап Recenza (Фаза 12) → /srv/recenza/bin/backup.sh (запускает recenza-backup.timer).
# SQLite .backup (консистентный снапшот под живым сервером) + tar загрузок; ротация 7 копий.
# Offsite-копирование — backlog (см. Журнал Фазы 12).
set -euo pipefail

DIR=/srv/recenza/backups
DB=/srv/recenza/shared/data/blog.prod.db
TS=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DIR"
sqlite3 "$DB" ".backup '$DIR/blog-$TS.db'"
tar -czf "$DIR/uploads-$TS.tar.gz" -C /srv/recenza/shared uploads

ls -1t "$DIR"/blog-*.db 2>/dev/null | tail -n +8 | xargs -r rm --
ls -1t "$DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm --

echo "[backup] ok: blog-$TS.db + uploads-$TS.tar.gz"
