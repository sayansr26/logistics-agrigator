-- Migration: Simplify Pincode Types
-- Date: 2026-01-29
-- Description: Remove junction tables and simplify PincodeType model

-- Step 1: Drop junction tables (CASCADE handles foreign key constraints)
DROP TABLE IF EXISTS "pincode_type_assignments" CASCADE;
DROP TABLE IF EXISTS "pincode_type_service_charges" CASCADE;

-- Step 2: Remove description column (no longer needed)
ALTER TABLE "pincode_types" DROP COLUMN IF EXISTS "description";

-- Step 3: Add type column (default to 'yes_no' for existing records)
ALTER TABLE "pincode_types" ADD COLUMN "type" VARCHAR(20) NOT NULL DEFAULT 'yes_no';

-- Step 4: Create index for performance
CREATE INDEX IF NOT EXISTS "pincode_types_is_active_type_idx" ON "pincode_types"("is_active", "type");

-- Step 5: Add CHECK constraint for type enum
ALTER TABLE "pincode_types" ADD CONSTRAINT "pincode_types_type_check"
  CHECK (type IN ('yes_no', 'number'));

-- Step 6: Remove old index (will be replaced by new composite index)
DROP INDEX IF EXISTS "pincode_types_is_active_idx";
