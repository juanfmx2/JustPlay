#!/usr/bin/env bash
set -euo pipefail

echo "Starting remote global standings loop..."

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

cutoff_time="${CUTOFF_TIME:-22:30}"
interval_minutes="${INTERVAL_MINUTES:-2}"

if [[ ! "${cutoff_time}" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]]; then
  echo "Invalid CUTOFF_TIME format: ${cutoff_time}. Expected HH:MM (24h)." >&2
  exit 1
fi

if [[ ! "${interval_minutes}" =~ ^[0-9]+$ ]] || [[ "${interval_minutes}" -lt 1 ]]; then
  echo "Invalid INTERVAL_MINUTES: ${interval_minutes}. Expected a positive integer." >&2
  exit 1
fi

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
interval_seconds="$((interval_minutes * 60))"

ssh \
  -i "${tmp_key_file}" \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=accept-new \
  -tt "${SSH_USER}@${SSH_HOST}" \
  "bash -s -- '${db_url_b64}' '${cutoff_time}' '${interval_seconds}'" <<'REMOTE_SCRIPT'
set -euo pipefail

database_url_b64="$1"
cutoff_time="$2"
interval_seconds="$3"

database_url="$(printf '%s' "${database_url_b64}" | base64 -d)"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm was not found in PATH during remote standings run." >&2
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

today="$(date +%F)"
cutoff_epoch="$(date -d "${today} ${cutoff_time}:00" +%s)"
now_epoch="$(date +%s)"

echo "Remote host time: $(date)"
echo "Running every ${interval_seconds}s until ${today} ${cutoff_time} (server local time)."

if [[ "${now_epoch}" -gt "${cutoff_epoch}" ]]; then
  echo "Cutoff time already passed on remote host. Exiting without running."
  exit 0
fi

while [[ "$(date +%s)" -le "${cutoff_epoch}" ]]; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running calculateGlobalStandings..."
  DATABASE_URL="${database_url}" pnpm tsx src-util/sl-2026/calculateGlobalStandings.ts

  if [[ "$(date +%s)" -ge "${cutoff_epoch}" ]]; then
    break
  fi

  sleep "${interval_seconds}"
done

echo "Finished standings loop at $(date)."
REMOTE_SCRIPT
