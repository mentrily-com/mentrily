#!/bin/sh
set -e

echo "Preparing database migrations..."

# Mark the previously failed migration as already applied (fixes Prisma P3009 error).
# The database already has all the tables/columns from this migration (applied manually),
# so we use --applied to tell Prisma to record it as done without re-running the SQL.
# Safe to run even when the migration is already recorded — the command will simply exit.
# NOTE: Once the migration has been successfully deployed, this line can be removed.
npx prisma migrate resolve --applied 20260314121000_add_bug_reports 2>/dev/null || true

echo "Deploying database migrations..."

MAX_ATTEMPTS=${MIGRATE_MAX_ATTEMPTS:-6}
SLEEP_SECONDS=${MIGRATE_RETRY_DELAY_SECONDS:-10}
ATTEMPT=1

while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
	echo "Migration attempt ${ATTEMPT}/${MAX_ATTEMPTS}..."

	if npx prisma migrate deploy; then
		echo "Database migrations applied successfully."
		break
	fi

	if [ "$ATTEMPT" -eq "$MAX_ATTEMPTS" ]; then
		echo "Migration failed after ${MAX_ATTEMPTS} attempts. Exiting."
		exit 1
	fi

	echo "Migration attempt failed. Retrying in ${SLEEP_SECONDS}s..."
	sleep "$SLEEP_SECONDS"
	ATTEMPT=$((ATTEMPT + 1))
done

echo "Starting application..."
exec npm run start:prod
