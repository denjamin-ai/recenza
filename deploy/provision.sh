#!/usr/bin/env bash
# Однократный провижининг VPS Recenza (Фаза 12), Ubuntu 24.04. Запускать от root.
# Использование: AMNEZIA_UDP_PORT=<порт> DEPLOY_PUBKEY="ssh-ed25519 AAAA..." bash provision.sh
#   AMNEZIA_UDP_PORT — UDP-порт AmneziaWG (обязателен: ufw не должен отрезать VPN);
#   DEPLOY_PUBKEY    — публичный ключ деплоя (пишется в authorized_keys пользователя recenza).
# Скрипт идемпотентен: повторный запуск безопасен.
set -euo pipefail

: "${AMNEZIA_UDP_PORT:?Укажи AMNEZIA_UDP_PORT (UDP-порт AmneziaWG), иначе ufw отрежет VPN}"
: "${DEPLOY_PUBKEY:?Укажи DEPLOY_PUBKEY (публичный ssh-ключ деплоя)}"

echo "== 1. Пользователь recenza и каталоги =="
id -u recenza &>/dev/null || useradd --system --create-home --shell /bin/bash recenza
mkdir -p /srv/recenza/{releases,backups,bin} /srv/recenza/shared/{data,uploads}
chown -R recenza:recenza /srv/recenza
chmod 750 /srv/recenza /srv/recenza/shared
# Caddy отдаёт /uploads/* напрямую с диска — ему нужен group-r/x доступ к shared/uploads
# (найдено HTTPS-smoke'ом Фазы 12: без этого file_server отвечал 403).
chmod -R g+rX /srv/recenza/shared/uploads

echo "== 2. SSH-ключ деплоя =="
install -d -m 700 -o recenza -g recenza /home/recenza/.ssh
grep -qF "$DEPLOY_PUBKEY" /home/recenza/.ssh/authorized_keys 2>/dev/null || \
  echo "$DEPLOY_PUBKEY" >> /home/recenza/.ssh/authorized_keys
chown recenza:recenza /home/recenza/.ssh/authorized_keys
chmod 600 /home/recenza/.ssh/authorized_keys

echo "== 3. Node 22 LTS =="
if ! command -v node &>/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "== 4. Пакеты: Caddy, sqlite3, ufw, unattended-upgrades =="
if ! command -v caddy &>/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi
apt-get install -y sqlite3 ufw unattended-upgrades rsync
dpkg-reconfigure -f noninteractive unattended-upgrades || true
# Доступ Caddy к /srv/recenza/shared/uploads (см. шаг 1) — через группу recenza.
usermod -aG recenza caddy

echo "== 5. Swap 2G (страховка для 2 ГБ RAM) =="
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -qF '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 6. ufw (22/80/443 + AmneziaWG UDP:$AMNEZIA_UDP_PORT) =="
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow "${AMNEZIA_UDP_PORT}/udp"
ufw --force enable

echo "== 7. sudoers: recenza может только рестартовать сервис =="
cat > /etc/sudoers.d/recenza-deploy <<'EOF'
recenza ALL=(root) NOPASSWD: /usr/bin/systemctl restart recenza
EOF
chmod 440 /etc/sudoers.d/recenza-deploy

echo "== 8. systemd-юниты и Caddyfile (файлы кладёт деплой-скрипт рядом) =="
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install -m 644 "$HERE/recenza.service" /etc/systemd/system/recenza.service
install -m 644 "$HERE/recenza-publish.service" /etc/systemd/system/recenza-publish.service
install -m 644 "$HERE/recenza-publish.timer" /etc/systemd/system/recenza-publish.timer
install -m 644 "$HERE/recenza-backup.service" /etc/systemd/system/recenza-backup.service
install -m 644 "$HERE/recenza-backup.timer" /etc/systemd/system/recenza-backup.timer
install -m 755 -o recenza -g recenza "$HERE/backup.sh" /srv/recenza/bin/backup.sh
install -m 644 "$HERE/Caddyfile" /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable recenza-publish.timer recenza-backup.timer
systemctl restart caddy

echo "== 9. SSH-hardening: только ключи =="
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/90-recenza-hardening.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
KbdInteractiveAuthentication no
EOF
sshd -t && systemctl reload ssh

echo "== Готово. Дальше: заполни /srv/recenza/shared/env (chmod 600, владелец recenza),"
echo "   затем деплой релиза (workflow deploy.yml) → systemctl enable --now recenza."
