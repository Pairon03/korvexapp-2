#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
name=fitcore-saas-postgres
if docker container inspect "$name" >/dev/null 2>&1; then
  docker start "$name" >/dev/null
else
  mkdir -p ../.local/postgres
  docker run -d --name "$name" --label project=fitcore-saas \
    -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=fitcore \
    -p 127.0.0.1:54329:5432 \
    -v "$(cd .. && pwd)/.local/postgres:/var/lib/postgresql/data" \
    postgres:17-alpine >/dev/null
fi
for attempt in $(seq 1 30); do
  if docker exec "$name" pg_isready -U postgres -d fitcore >/dev/null 2>&1; then
    echo 'Local PostgreSQL ready on port 54329 (development only).'
    exit 0
  fi
  sleep 1
done
echo 'PostgreSQL did not become ready.' >&2
exit 1
