#!/usr/bin/env bash
# Installs or updates the game on a fresh Ubuntu/Debian server:
#   curl -fsSL https://raw.githubusercontent.com/biktorb/tlelgram_test/main/deploy/install.sh | sudo bash
# Run it again later to update to the latest version.
set -euo pipefail

REPO="https://github.com/biktorb/tlelgram_test.git"
DIR="/opt/otryad"

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root: ... | sudo bash" >&2
  exit 1
fi

echo "==> Пакеты"
apt-get update -qq
apt-get install -y -qq git curl ca-certificates openssl >/dev/null

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Docker"
  # get.docker.com gives the newest Docker; Ubuntu's own packages are the fallback
  # when that host is unreachable from the server.
  if ! { curl -fsSL --retry 3 https://get.docker.com -o /tmp/get-docker.sh && sh /tmp/get-docker.sh >/dev/null; }; then
    echo "get.docker.com недоступен, ставлю Docker из репозитория Ubuntu"
    apt-get install -y -qq docker.io docker-compose-v2 >/dev/null
    systemctl enable --now docker
  fi
fi

# The image build needs more than 1 GB of memory.
if [ "$(swapon --show | wc -l)" -eq 0 ] && [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 2000000 ]; then
  echo "==> Файл подкачки 2 ГБ"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Код игры"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull -q --ff-only
else
  git clone -q "$REPO" "$DIR"
fi
cd "$DIR"

if [ ! -f .env ]; then
  echo "==> Настройка"
  IP="$(curl -4 -fsS https://api.ipify.org || true)"
  DEFAULT_DOMAIN="${IP//./-}.sslip.io"
  read -r -p "Домен игры [$DEFAULT_DOMAIN]: " DOMAIN </dev/tty || true
  DOMAIN="${DOMAIN:-$DEFAULT_DOMAIN}"
  TOKEN=""
  while [ -z "$TOKEN" ]; do
    read -r -s -p "Токен бота из @BotFather (ввод скрыт): " TOKEN </dev/tty || true
    echo
  done
  umask 077
  cat > .env <<ENV
DOMAIN=$DOMAIN
TELEGRAM_BOT_TOKEN=$TOKEN
POSTGRES_PASSWORD=$(openssl rand -hex 24)
ENV
fi
DOMAIN="$(grep '^DOMAIN=' .env | cut -d= -f2-)"

echo "==> Сборка и запуск (первый раз 5–10 минут)"
docker compose up -d --build --remove-orphans

echo "==> Проверка https://$DOMAIN"
for _ in $(seq 1 60); do
  if curl -fsS "https://$DOMAIN/api/health" >/dev/null 2>&1; then
    echo
    echo "Готово: https://$DOMAIN/"
    echo "В @BotFather: /myapps → ваше приложение → Edit Web App URL → https://$DOMAIN/"
    exit 0
  fi
  sleep 5
done
echo "Сервер не ответил по HTTPS за 5 минут. Логи: cd $DIR && docker compose logs --tail 50" >&2
exit 1
