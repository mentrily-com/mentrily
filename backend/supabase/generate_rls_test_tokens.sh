#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" || -z "${SUPABASE_DIRECT_URL:-}" ]]; then
  echo "SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DIRECT_URL are required"
  exit 1
fi

ORG_ID="$(psql "${SUPABASE_DIRECT_URL}" -Atc 'SELECT "id"::text FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1;')"
if [[ -z "${ORG_ID}" ]]; then
  ORG_ID="$(psql "${SUPABASE_DIRECT_URL}" -Atc "INSERT INTO \"Organization\"(\"name\",\"slug\") VALUES ('RLS Test Org','rls-test-org') RETURNING \"id\"::text;")"
fi

create_and_login() {
  local email="$1"
  local password="$2"
  local app_role="$3"
  local app_user_id="$4"

  local create_response
  create_response="$(curl -sS -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"email_confirm\":true,\"app_metadata\":{\"app_role\":\"${app_role}\",\"org_id\":\"${ORG_ID}\",\"app_user_id\":\"${app_user_id}\"}}" \
    -w "\n%{http_code}")"

  local create_status
  create_status="$(printf '%s' "${create_response}" | tail -n1)"
  local create_body
  create_body="$(printf '%s' "${create_response}" | sed '$d')"

  if [[ "${create_status}" != "200" && "${create_status}" != "201" ]]; then
    echo "Failed creating test user ${email} (${create_status}): ${create_body}" >&2
    return 1
  fi

  local attempt
  for attempt in 1 2 3 4 5; do
    local login_body
    login_body="$(curl -sS -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${email}\",\"password\":\"${password}\"}")"

    local access_token
    access_token="$(printf '%s' "${login_body}" | python3 -c 'import sys,json; data=json.load(sys.stdin); print(data.get("access_token",""))')"
    if [[ -n "${access_token}" ]]; then
      printf '%s\n' "${access_token}"
      return 0
    fi

    if [[ "${attempt}" -lt 5 ]]; then
      sleep 1
    fi
  done

  echo "Failed logging in test user ${email}: ${login_body}" >&2
  return 1
}

stamp="$(date +%s)"
pass_base="RlsTest!${stamp}"

super_user_id="$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"
admin_user_id="$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"
teacher_user_id="$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"
student_user_id="$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"

super_email="rls.superadmin.${stamp}@example.com"
admin_email="rls.admin.${stamp}@example.com"
teacher_email="rls.teacher.${stamp}@example.com"
student_email="rls.student.${stamp}@example.com"

super_token="$(create_and_login "${super_email}" "${pass_base}A" "SUPER_ADMIN" "${super_user_id}")"
admin_token="$(create_and_login "${admin_email}" "${pass_base}B" "ADMIN" "${admin_user_id}")"
teacher_token="$(create_and_login "${teacher_email}" "${pass_base}C" "TEACHER" "${teacher_user_id}")"
student_token="$(create_and_login "${student_email}" "${pass_base}D" "STUDENT" "${student_user_id}")"

if [[ -z "${super_token}" || -z "${admin_token}" || -z "${teacher_token}" || -z "${student_token}" ]]; then
  echo "Failed to generate one or more RLS tokens"
  exit 1
fi

python3 - <<PY
from pathlib import Path
import re

env_path = Path(r"${ENV_FILE}")
content = env_path.read_text()
updates = {
  "SUPABASE_TEST_JWT_SUPER_ADMIN": "${super_token}",
  "SUPABASE_TEST_JWT_ADMIN": "${admin_token}",
  "SUPABASE_TEST_JWT_TEACHER": "${teacher_token}",
  "SUPABASE_TEST_JWT_STUDENT": "${student_token}",
}
for k,v in updates.items():
  pattern = re.compile(rf'^'+re.escape(k)+r'=.*$', re.M)
  line = f'{k}="{v}"'
  if pattern.search(content):
    content = pattern.sub(line, content)
  else:
    if not content.endswith('\n'):
      content += '\n'
    content += line + '\n'
env_path.write_text(content)
PY

echo "RLS test tokens generated and written to .env"
