#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORDER_FILE="${ROOT_DIR}/table_order.txt"
CHECKS_SQL="${ROOT_DIR}/verification_checks.sql"

if [[ -z "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "SOURCE_DATABASE_URL is required"
  exit 1
fi

if [[ -z "${TARGET_DIRECT_URL:-}" ]]; then
  echo "TARGET_DIRECT_URL is required"
  exit 1
fi

if [[ ! -f "${ORDER_FILE}" ]]; then
  echo "Missing table order file: ${ORDER_FILE}"
  exit 1
fi

if [[ ! -f "${CHECKS_SQL}" ]]; then
  echo "Missing verification SQL: ${CHECKS_SQL}"
  exit 1
fi

echo "[verify] Row count parity"
printf '%-28s %-12s %-12s %-8s\n' "table" "source" "target" "status"

failed=0
while IFS= read -r table || [[ -n "$table" ]]; do
  [[ -z "$table" ]] && continue

  source_count=$(psql "${SOURCE_DATABASE_URL}" -Atc "SELECT COUNT(*) FROM \"${table}\";")
  target_count=$(psql "${TARGET_DIRECT_URL}" -Atc "SELECT COUNT(*) FROM \"${table}\";")

  status="OK"
  if [[ "$source_count" != "$target_count" ]]; then
    status="MISMATCH"
    failed=1
  fi

  printf '%-28s %-12s %-12s %-8s\n' "$table" "$source_count" "$target_count" "$status"
done < "${ORDER_FILE}"

echo
echo "[verify] Integrity checks (all invalid_count should be 0)"
psql "${TARGET_DIRECT_URL}" -v ON_ERROR_STOP=1 -f "${CHECKS_SQL}"

if [[ "$failed" -ne 0 ]]; then
  echo
  echo "[verify] Row-count mismatch detected."
  exit 1
fi

echo
echo "[verify] Row counts matched. Review integrity check output above."