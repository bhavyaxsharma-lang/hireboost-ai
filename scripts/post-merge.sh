#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Idempotent schema migrations — safe to run multiple times.
# Add columns that drizzle-kit push may skip or that need to be applied before push.
psql "$DATABASE_URL" -c "ALTER TABLE password_reset_otps ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;"
pnpm --filter db push
