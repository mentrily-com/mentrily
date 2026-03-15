#!/bin/sh
set -e

RUN_MIGRATIONS_ON_START=${RUN_MIGRATIONS_ON_START:-false}
MIGRATE_RESOLVE_LEGACY=${MIGRATE_RESOLVE_LEGACY:-false}

if [ "$RUN_MIGRATIONS_ON_START" = "true" ]; then
	echo "Preparing database migrations..."

	# Optional legacy migration resolve for environments that had manual DB patching.
	if [ "$MIGRATE_RESOLVE_LEGACY" = "true" ]; then
		npx prisma migrate resolve --applied 20260314121000_add_bug_reports 2>/dev/null || true
	fi

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
else
	echo "Skipping migrations on startup (RUN_MIGRATIONS_ON_START=false)."
fi

echo "Starting application..."
exec npm run start:prod
