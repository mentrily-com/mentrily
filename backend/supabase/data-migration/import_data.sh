#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORDER_FILE="${ROOT_DIR}/table_order.txt"
MIGRATION_DIR="${MIGRATION_DIR:-${ROOT_DIR}/output}"
TABLES_DIR="${MIGRATION_DIR}/tables"

if [[ -z "${TARGET_DIRECT_URL:-}" ]]; then
  echo "TARGET_DIRECT_URL is required"
  exit 1
fi

if [[ ! -d "${TABLES_DIR}" ]]; then
  echo "Missing tables directory: ${TABLES_DIR}. Run export_data.sh first."
  exit 1
fi

echo "[import] Starting ordered import into target database..."
i=1
while IFS= read -r table || [[ -n "$table" ]]; do
  [[ -z "$table" ]] && continue

  file="${TABLES_DIR}/$(printf "%02d" "$i")_${table}.sql"
  if [[ ! -f "${file}" ]]; then
    echo "Missing table dump: ${file}"
    exit 1
  fi

  echo "  -> ${table}"
  psql "${TARGET_DIRECT_URL}" -v ON_ERROR_STOP=1 -f "${file}"
  i=$((i + 1))
done < "${ORDER_FILE}"

echo "[import] Done."