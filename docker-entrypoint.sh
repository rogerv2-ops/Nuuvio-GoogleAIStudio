#!/bin/sh
# Garantiza schema de Postgres antes de arrancar: ningún deploy borra ni rompe data.
set -u
case "${SQL_HOST:-}" in
  postgresql-database-*) SQL_HOST="oa0t0nzguh49o1fim0juu5nj" ;;
  ""|" ") SQL_HOST="oa0t0nzguh49o1fim0juu5nj" ;;
esac
export SQL_HOST SQL_DB_NAME
export SQL_ADMIN_USER="${SQL_ADMIN_USER:-${SQL_USER:-${SQL_USE:-}}}"
export SQL_ADMIN_PASSWORD="${SQL_ADMIN_PASSWORD:-${SQL_PASSWORD:-}}"
export PATH="/app/node_modules/.bin:$PATH"
echo "[entrypoint] applying DB schema on $SQL_HOST/$SQL_DB_NAME ..."
if [ -z "${SQL_ADMIN_USER:-}" ] || [ -z "${SQL_ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] WARN: sin credenciales admin, salto migrate (la app igual arranca)"
else
  yes "" | timeout 120 bunx drizzle-kit push --config=src/db/drizzle.config.ts \
    && echo "[entrypoint] schema OK" \
    || echo "[entrypoint] WARN: migrate falló o timed out, la app igual arranca"
fi
exec bun run start
