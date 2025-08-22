#!/bin/sh
echo "Running Prisma migrations..."
npx prisma migrate deploy || echo "Migration failed or no migrations to apply"
echo "Starting server with auto-reload..."
exec pnpm run dev
