#!/usr/bin/env bash
echo "Starting EC2 deployment..."
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
  -T "${SSH_USER}@${SSH_HOST}" \
  "bash -s -- '${db_url_b64}'" <<'REMOTE_SCRIPT'
set -euo pipefail

database_url_b64="$1"

database_url="$(printf '%s' "${database_url_b64}" | base64 -d)"

# Non-interactive SSH sessions skip shell init files, so restore a sane PATH first.
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Load bashrc explicitly so non-interactive SSH sessions get user PATH setup.
if [[ -f "$HOME/.bashrc" ]]; then
  # shellcheck disable=SC1091
  . "$HOME/.bashrc"
fi

if [[ -d "$HOME/.local/share/pnpm" ]]; then
  export PNPM_HOME="$HOME/.local/share/pnpm"
  export PATH="$PNPM_HOME:$PATH"
fi

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use --lts >/dev/null 2>&1 || true
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm was not found in PATH during remote deploy." >&2
  echo "PATH=$PATH" >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 was not found in PATH during remote deploy." >&2
  echo "PATH=$PATH" >&2
  exit 1
fi

if [[ -d "$HOME/JustPlay" ]]; then
  cd "$HOME/JustPlay"
elif [[ -d "$HOME/JustPLay" ]]; then
  cd "$HOME/JustPLay"
else
  echo "Could not find JustPlay directory in $HOME." >&2
  exit 1
fi

unset PM2_NO_DAEMON

pm2 stop justplay || true
pm2 delete justplay || true
git pull --ff-only
DATABASE_URL="${database_url}" pnpm build
DATABASE_URL="${database_url}" pnpm db:drop-tables
DATABASE_URL="${database_url}" pnpm db:gen-sl2026
DATABASE_URL="${database_url}" pm2 start "pnpm dev" --name justplay --update-env </dev/null
pm2 save
pm2 status
REMOTE_SCRIPT
