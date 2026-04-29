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

echo "[supabase-deploy] Ensuring migration tracking table"
psql "${TARGET_URL}" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public._schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

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
