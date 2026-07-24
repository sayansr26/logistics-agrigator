-- Add government (MoF X/Y/Z) city classification + metro flag to cities.
-- Written idempotently (IF NOT EXISTS) because dev databases already received
-- these columns via `prisma db push` before this migration existed.

ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "cityClass" VARCHAR(1) NOT NULL DEFAULT 'Z';
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "isMetro" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "cities_isMetro_idx" ON "cities"("isMetro");
