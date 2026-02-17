-- ============================================================
-- Migration: charges_engine_redesign
-- Replaces the old kind+slabs ChargeRule model with the new
-- Partner + Base + min/percentage/perKg/perKgCharge + milestone FK model.
-- BREAKING: existing charge_rules rows will become invalid.
-- Re-enter rules after this migration.
-- ============================================================

-- Drop old columns from charge_rules (keep fromZoneId, toZoneId)
ALTER TABLE "charge_rules"
  DROP COLUMN IF EXISTS "kind",
  DROP COLUMN IF EXISTS "from_amount",
  DROP COLUMN IF EXISTS "to_amount",
  DROP COLUMN IF EXISTS "charge",
  DROP COLUMN IF EXISTS "calc_type",
  DROP COLUMN IF EXISTS "min_kg",
  DROP COLUMN IF EXISTS "max_kg",
  DROP COLUMN IF EXISTS "min_weight_kg",
  DROP COLUMN IF EXISTS "addon_weight_kg",
  DROP COLUMN IF EXISTS "weight_charge",
  DROP COLUMN IF EXISTS "addon_charge",
  DROP COLUMN IF EXISTS "division",
  DROP COLUMN IF EXISTS "from_km",
  DROP COLUMN IF EXISTS "to_km";

-- Add new columns
ALTER TABLE "charge_rules"
  ADD COLUMN IF NOT EXISTS "min_value" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "percentage_value" DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS "per_kg" DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS "per_kg_charge" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "zone_milestone_id" UUID;

-- Add FK constraint for zone_milestone_id (idempotent: safe if db push already added it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'charge_rules_zone_milestone_id_fkey'
      AND table_name = 'charge_rules'
  ) THEN
    ALTER TABLE "charge_rules"
      ADD CONSTRAINT "charge_rules_zone_milestone_id_fkey"
      FOREIGN KEY ("zone_milestone_id")
      REFERENCES "zone_milestones"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- Drop old enums (they may not exist if Prisma hadn't created them yet, use IF EXISTS)
DROP TYPE IF EXISTS "ChargeRuleKind";
DROP TYPE IF EXISTS "ChargeCalcType";

-- Drop old index referencing kind column (may have been auto-generated)
DROP INDEX IF EXISTS "charge_rules_partner_id_kind_base_is_active_idx";

-- Create new indexes
CREATE INDEX IF NOT EXISTS "charge_rules_partner_id_base_is_active_idx"
  ON "charge_rules"("partner_id", "base", "is_active");

CREATE INDEX IF NOT EXISTS "charge_rules_partner_id_zone_milestone_id_is_active_idx"
  ON "charge_rules"("partner_id", "zone_milestone_id", "is_active");
