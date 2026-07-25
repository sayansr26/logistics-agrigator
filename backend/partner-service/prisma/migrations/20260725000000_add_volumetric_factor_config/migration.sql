-- Per-channel volumetric formula: ((boxes * L*W*H) / divisor) * factor
--
-- NULL on either column means "use the system default" (27000 / 6), resolved at
-- read time by shared/utils/weightCalc.resolveVolumetricConfig(). The divisor
-- therefore loses its NOT NULL / DEFAULT 5000 so that NULL can carry meaning.

ALTER TABLE "partner_channel_configs"
  ALTER COLUMN "volumetric_divisor" DROP NOT NULL,
  ALTER COLUMN "volumetric_divisor" DROP DEFAULT;

ALTER TABLE "partner_channel_configs"
  ADD COLUMN "volumetric_factor" DOUBLE PRECISION;

-- Existing rows sit at the old default of 5000 and were never editable through
-- any UI (the field was stripped by the Joi schemas), so they are unconfigured
-- rather than deliberately set. Null them out to adopt the system default.
UPDATE "partner_channel_configs"
  SET "volumetric_divisor" = NULL
  WHERE "volumetric_divisor" = 5000;

-- Any row with a divisor other than 5000 was set by hand directly in the DB and
-- is preserved as-is. Its factor stays NULL and therefore resolves to 6, which
-- changes its effective formula from L*W*H/d to (L*W*H/d)*6. Set the factor to 1
-- on those rows if the stored divisor was meant to be taken literally.
