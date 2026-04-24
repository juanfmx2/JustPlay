#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  SSH_HOST
  SSH_USER
  SSH_PASSWORD
  ID_ED25519_CONTENT
  DATABASE_URL
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass is required but was not found." >&2
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required but was not found." >&2
  exit 1
fi

key_b64="$(printf '%s' "${ID_ED25519_CONTENT}" | base64 -w0)"
db_url_b64="$(printf '%s' "${DATABASE_URL}" | base64 -w0)"

sshpass -p "${SSH_PASSWORD}" ssh \
  -o StrictHostKeyChecking=accept-new \
  -tt "${SSH_USER}@${SSH_HOST}" \
  "bash -s -- '${key_b64}' '${db_url_b64}'" <<'REMOTE_SCRIPT'
set -euo pipefail

id_ed25519_content_b64="$1"
database_url_b64="$2"

id_ed25519_content="$(printf '%s' "${id_ed25519_content_b64}" | base64 -d)"
database_url="$(printf '%s' "${database_url_b64}" | base64 -d)"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
printf '%s\n' "${id_ed25519_content}" > "$HOME/.ssh/id_ed25519"
chmod 600 "$HOME/.ssh/id_ed25519"
touch "$HOME/.ssh/known_hosts"
ssh-keyscan -t rsa github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
chmod 644 "$HOME/.ssh/known_hosts"

if [[ -d "$HOME/JustPlay" ]]; then
  cd "$HOME/JustPlay"
elif [[ -d "$HOME/JustPLay" ]]; then
  cd "$HOME/JustPLay"
else
  echo "Could not find JustPlay directory in $HOME." >&2
  exit 1
fi

pm2 stop justplay || true
pm2 delete justplay || true
git pull --ff-only
DATABASE_URL="${database_url}" pnpm build
DATABASE_URL="${database_url}" pm2 start "pnpm dev" --name justplay --update-env
REMOTE_SCRIPT
