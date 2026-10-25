#!/usr/bin/env bash
# Pulls the latest main and restarts the stack. GitHub Actions runs it over SSH
# (the deploy key can run only this script, see enable-autodeploy.sh).
# Everything is inside main() so that git pull rewriting this file mid-run is safe.
set -euo pipefail

main() {
  cd /opt/otryad
  echo "==> Код"
  git pull -q --ff-only
  git log -1 --format='%h %s'
  echo "==> Сборка и перезапуск"
  docker compose up -d --build --remove-orphans
  docker image prune -f >/dev/null
  local domain
  domain="$(grep '^DOMAIN=' .env | cut -d= -f2-)"
  echo "==> Проверка https://$domain"
  for _ in $(seq 1 30); do
    if curl -fsS "https://$domain/api/health" >/dev/null 2>&1; then
      echo "Обновлено: https://$domain/"
      return 0
    fi
    sleep 5
  done
  echo "Сервер не ответил за 2,5 минуты" >&2
  docker compose logs --tail 50 server >&2
  return 1
}

main "$@"
exit
