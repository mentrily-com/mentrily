#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS_ON_START:-false}" = "true" ]; then
  npx prisma migrate deploy
fi

if [ -z "${REDIS_URL:-}" ] && { [ -z "${REDIS_HOST:-}" ] || [ "${REDIS_HOST}" = "localhost" ] || [ "${REDIS_HOST}" = "127.0.0.1" ]; }; then
  redis-server --daemonize yes --bind 127.0.0.1 --port "${REDIS_PORT:-6379}"
fi

exec npm run start:prod
