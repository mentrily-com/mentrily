#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${ROOT_DIR}/migrations"

TARGET_URL="${SUPABASE_DIRECT_URL:-${TARGET_DIRECT_URL:-}}"

if [[ -z "${TARGET_URL}" ]]; then
  echo "SUPABASE_DIRECT_URL (or TARGET_DIRECT_URL) is required"
  exit 1
fi

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "Migrations directory not found: ${MIGRATIONS_DIR}"
  exit 1
fi

# Prisma owns table creation and column types (see backend/prisma/migrations
# and docker-entrypoint.sh's `prisma migrate deploy` on container start) --
# 00001_schema.sql is a one-time snapshot from before that was true and no
# longer matches the schema Prisma actually creates (it declares UUID id
# columns; every Prisma model has used `id String @default(uuid())` -- a
# TEXT column storing a UUID string -- for a long time now). Re-running it
# against a database Prisma already created fails immediately (a
# `type "Plan" does not exist` / `uuid = text` mismatch), and because every
# later file runs in this same loop with ON_ERROR_STOP=1, that failure was
# silently blocking 00002 onward -- the actual RPCs and RLS policies this
# script exists to deploy -- from ever being applied to a fresh environment.
#
# Make Prisma's migrations a real prerequisite instead of an unstated
# assumption, and run this before creating _schema_migrations below:
# `prisma migrate deploy` refuses to touch a schema that already has
# tables it doesn't recognize, so it has to see a genuinely empty (or
# already Prisma-tracked) database, not one that already has our own
# tracking table sitting in it.
echo "[supabase-deploy] Ensuring Prisma-owned schema exists"
(cd "${ROOT_DIR}/.." && npx prisma migrate deploy)

echo "[supabase-deploy] Ensuring migration tracking table"
psql "${TARGET_URL}" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public._schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

# Mark 00001 as already handled by the Prisma step above rather than
# trying to run SQL that no longer describes the real schema.
psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -c \
  "INSERT INTO public._schema_migrations(filename) VALUES ('00001_schema.sql') ON CONFLICT (filename) DO NOTHING;"

echo "[supabase-deploy] Applying pending migrations"
for migration_file in "${MIGRATIONS_DIR}"/*.sql; do
  filename="$(basename "${migration_file}")"

  already_applied=$(psql "${TARGET_URL}" -Atc "SELECT 1 FROM public._schema_migrations WHERE filename='${filename}' LIMIT 1;")
  if [[ "${already_applied}" == "1" ]]; then
    echo "  - ${filename} (already applied)"
    continue
  fi

  echo "  - ${filename} (applying)"
  psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -f "${migration_file}"
  psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -c "INSERT INTO public._schema_migrations(filename) VALUES ('${filename}');"
done

echo "[supabase-deploy] Done"
