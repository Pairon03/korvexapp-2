#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
mkdir -p .local/backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file=".local/backups/fitcore-$stamp.dump"
docker exec fitcore-saas-postgres pg_dump -U postgres -Fc fitcore > "$file"
if [ -d .local/photos ]; then
  tar -czf ".local/backups/photos-$stamp.tar.gz" -C .local photos
fi
printf '%s\n' "$file"
