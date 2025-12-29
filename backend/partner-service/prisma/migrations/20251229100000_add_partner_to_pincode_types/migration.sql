-- Migration: Add partner_id to pincode_types for partner-specific pincode types
-- This migration makes pincode types partner-specific

-- Step 1: Delete existing pincode_type_assignments (to remove FK constraint issues)
DELETE FROM "pincode_type_assignments";

-- Step 2: Delete existing pincode_types (they need to be recreated with partner association)
DELETE FROM "pincode_types";

-- Step 3: Drop the existing unique constraint on name
DROP INDEX IF EXISTS "pincode_types_name_key";

-- Step 4: Add the partner_id column as NOT NULL
ALTER TABLE "pincode_types" ADD COLUMN "partner_id" TEXT NOT NULL;

-- Step 5: Create the new composite unique constraint
ALTER TABLE "pincode_types" ADD CONSTRAINT "pincode_types_partner_id_name_key" UNIQUE ("partner_id", "name");

-- Step 6: Create indexes for efficient querying
CREATE INDEX "pincode_types_partner_id_is_active_idx" ON "pincode_types"("partner_id", "is_active");
CREATE INDEX "pincode_types_partner_id_name_idx" ON "pincode_types"("partner_id", "name");

-- Step 7: Add foreign key constraint to partners table
ALTER TABLE "pincode_types" ADD CONSTRAINT "pincode_types_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

