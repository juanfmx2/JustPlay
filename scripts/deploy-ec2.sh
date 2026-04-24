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

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required but was not found." >&2
  exit 1
fi

if ! command -v ssh-keygen >/dev/null 2>&1; then
  echo "ssh-keygen is required but was not found." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
tmp_key_file="${tmp_dir}/id_ed25519"

cleanup() {
  rm -rf "${tmp_dir}"
}

trap cleanup EXIT

printf '%s\n' "${ID_ED25519_CONTENT}" > "${tmp_key_file}"
chmod 600 "${tmp_key_file}"

ssh-keygen -p -P "${SSH_PASSWORD}" -N '' -f "${tmp_key_file}" >/dev/null

db_url_b64="$(printf '%s' "${DATABASE_URL}" | base64 -w0)"

ssh \
  -i "${tmp_key_file}" \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=accept-new \
  -tt "${SSH_USER}@${SSH_HOST}" \
  "bash -s -- '${db_url_b64}'" <<'REMOTE_SCRIPT'
set -euo pipefail

database_url_b64="$1"

database_url="$(printf '%s' "${database_url_b64}" | base64 -d)"

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
