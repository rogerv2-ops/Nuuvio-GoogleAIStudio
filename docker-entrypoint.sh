#!/bin/sh
# Aplica las MIGRACIONES versionadas antes de arrancar: ningún deploy borra ni
# rompe data.
#
# PUNTO 5 DE LA AUDITORÍA: antes esto era `drizzle-kit push`, que compara el
# esquema del código contra la base y lo ALTERA en el arranque. Eso es
# peligroso: un cambio de esquema no revisado se aplica solo, contra
# producción, en cada deploy. Ahora el esquema se aplica con migraciones
# generadas y versionadas en `src/db/migrations` (cada una revisada en el
# pull request).
#
# La migración base (0000) crea las tablas. En una base que ya tenía el
# esquema puesto con `push` hay que MARCARLA como aplicada antes de migrar,
# o intentaría crear tablas que ya existen. Para eso está
# `scripts/mark-migrations-applied.mjs`.
set -u
case "${SQL_HOST:-}" in
  postgresql-database-*) SQL_HOST="oa0t0nzguh49o1fim0juu5nj" ;;
  ""|" ") SQL_HOST="oa0t0nzguh49o1fim0juu5nj" ;;
esac
export SQL_HOST SQL_DB_NAME
export SQL_ADMIN_USER="${SQL_ADMIN_USER:-${SQL_USER:-${SQL_USE:-}}}"
export SQL_ADMIN_PASSWORD="${SQL_ADMIN_PASSWORD:-${SQL_PASSWORD:-}}"
export PATH="/app/node_modules/.bin:$PATH"
echo "[entrypoint] applying DB migrations on $SQL_HOST/$SQL_DB_NAME ..."
if [ -z "${SQL_ADMIN_USER:-}" ] || [ -z "${SQL_ADMIN_PASSWORD:-}" ]; then
  echo "[entrypoint] WARN: sin credenciales admin, salto migrate (la app igual arranca)"
else
  timeout 180 bunx drizzle-kit migrate --config=src/db/drizzle.config.ts \
    && echo "[entrypoint] migrations OK" \
    || echo "[entrypoint] WARN: migrate falló o timed out, la app igual arranca"
fi
exec bun run start
