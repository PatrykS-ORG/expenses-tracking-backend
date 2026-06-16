#!/bin/sh
set -eu

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET is required" >&2
  exit 1
fi

if [ -z "${CRON_TARGET_URL:-}" ]; then
  echo "CRON_TARGET_URL is required" >&2
  exit 1
fi

echo "[$(date -Iseconds)] POST ${CRON_TARGET_URL}"

response="$(curl -sf -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${CRON_TARGET_URL}")"

echo "[$(date -Iseconds)] ${response}"
