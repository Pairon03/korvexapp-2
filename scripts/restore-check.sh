#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
file=${1:?Pass a local pg_dump backup file}
name="fitcore_restore_$(date -u +%Y%m%d%H%M%S)"
# A separate database is created. Existing application data is never replaced.
docker exec fitcore-saas-postgres createdb -U postgres "$name"
trap 'docker exec fitcore-saas-postgres dropdb -U postgres "$name" >/dev/null' EXIT
docker exec -i fitcore-saas-postgres pg_restore -U postgres --exit-on-error -d "$name" < "$file"
docker exec fitcore-saas-postgres psql -U postgres -d "$name" -v ON_ERROR_STOP=1 -c "select count(*) as restored_students from app.students; select count(*) as rls_tables from pg_tables where schemaname='app' and rowsecurity=true;"
