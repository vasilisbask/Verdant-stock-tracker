#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  DB_URL_NO_PROTO="${DATABASE_URL#*://}"
  DB_URL_NO_PATH="${DB_URL_NO_PROTO%%/*}"
  DB_HOST_PORT="${DB_URL_NO_PATH##*@}"
  
  if echo "$DB_HOST_PORT" | grep -q ":"; then
    DB_HOST="${DB_HOST_PORT%:*}"
    DB_PORT="${DB_HOST_PORT#*:}"
  else
    DB_HOST="$DB_HOST_PORT"
    DB_PORT=5432
  fi

  until pg_isready -h "$DB_HOST" -p "$DB_PORT" -t 2 > /dev/null 2>&1; do
    sleep 2
  done
  
  npx prisma migrate deploy
fi

exec node server.js
