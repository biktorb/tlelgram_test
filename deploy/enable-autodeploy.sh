#!/usr/bin/env bash
# Run once on the server to let GitHub Actions update the game after each merge:
#   sudo bash /opt/otryad/deploy/enable-autodeploy.sh
# Creates an SSH key that can only run deploy/update.sh and prints what to put into GitHub.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root: sudo bash $0" >&2
  exit 1
fi

KEY=/root/.ssh/otryad_deploy
mkdir -p /root/.ssh
chmod 700 /root/.ssh
if [ ! -f "$KEY" ]; then
  ssh-keygen -q -t ed25519 -N "" -C otryad-deploy -f "$KEY"
fi
AUTH=/root/.ssh/authorized_keys
touch "$AUTH"
chmod 600 "$AUTH"
if ! grep -q 'otryad-deploy' "$AUTH"; then
  echo "command=\"/opt/otryad/deploy/update.sh\",restrict $(cat "$KEY.pub")" >> "$AUTH"
fi

IP="$(curl -4 -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
cat <<MSG

Готово. Теперь в GitHub: репозиторий → Settings → Secrets and variables → Actions.

1. Вкладка Secrets → New repository secret
   Name:  DEPLOY_SSH_KEY
   Value: всё между линиями ниже, включая строки BEGIN и END

------------------------------------------------------------
$(cat "$KEY")
------------------------------------------------------------

2. Вкладка Variables → New repository variable
   Name:  DEPLOY_HOST
   Value: $IP

Этот ключ умеет только обновлять игру, войти с ним в консоль сервера нельзя.
Никуда, кроме секрета GitHub, его не отправляйте.
MSG
