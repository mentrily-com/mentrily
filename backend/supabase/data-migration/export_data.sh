#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORDER_FILE="${ROOT_DIR}/table_order.txt"
MIGRATION_DIR="${MIGRATION_DIR:-${ROOT_DIR}/output}"
FULL_DIR="${MIGRATION_DIR}/full"
TABLES_DIR="${MIGRATION_DIR}/tables"

if [[ -z "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "SOURCE_DATABASE_URL is required"
  exit 1
fi

if [[ ! -f "${ORDER_FILE}" ]]; then
  echo "Missing table order file: ${ORDER_FILE}"
  exit 1
fi

mkdir -p "${FULL_DIR}" "${TABLES_DIR}"

echo "[export] Writing full data dump..."
pg_dump \
  "${SOURCE_DATABASE_URL}" \
  --data-only \
  --inserts \
  --no-owner \
  --no-privileges \
  -f "${FULL_DIR}/export.sql"

echo "[export] Writing ordered per-table data dumps..."
i=1
while IFS= read -r table || [[ -n "$table" ]]; do
  [[ -z "$table" ]] && continue

  out_file="${TABLES_DIR}/$(printf "%02d" "$i")_${table}.sql"
  echo "  -> ${table}"
  pg_dump \
    "${SOURCE_DATABASE_URL}" \
    --data-only \
    --inserts \
    --no-owner \
    --no-privileges \
    --table="public.\"${table}\"" \
    -f "${out_file}"
  i=$((i + 1))
done < "${ORDER_FILE}"

echo "[export] Done. Outputs in: ${MIGRATION_DIR}"