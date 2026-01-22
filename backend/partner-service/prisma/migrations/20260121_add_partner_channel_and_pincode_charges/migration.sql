-- Migration: add_partner_channel_and_pincode_charges
-- This migration adds:
-- 1. ChannelMode enum for SINGLE/MULTI channel API management
-- 2. PartnerChannelConfig table for multi-channel API support
-- 3. Updated PincodeType table structure (partner-agnostic)
-- 4. PincodeTypeServiceCharge table for partner-specific charges

-- CreateEnum
CREATE TYPE "ChannelMode" AS ENUM ('SINGLE', 'MULTI');

-- Alter partners table to add channel_mode column
ALTER TABLE "partners" ADD COLUMN "channel_mode" "ChannelMode" NOT NULL DEFAULT 'SINGLE';

-- Drop old pincode_types table (with partner_id)
-- Note: In production with data, you would need to migrate data first
-- For this migration, we're recreating the table with the new structure
ALTER TABLE "pincode_type_assignments" DROP CONSTRAINT IF EXISTS "pincode_type_assignments_type_id_fkey";
DROP TABLE IF EXISTS "pincode_types" CASCADE;

-- Create new pincode_types table (partner-agnostic, UUID-based)
CREATE TABLE "pincode_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pincode_types_pkey" PRIMARY KEY ("id")
);

-- Create unique index on name
CREATE UNIQUE INDEX "pincode_types_name_key" ON "pincode_types"("name");
CREATE INDEX "pincode_types_is_active_idx" ON "pincode_types"("is_active");

-- Recreate foreign key constraint
ALTER TABLE "pincode_type_assignments" ADD CONSTRAINT "pincode_type_assignments_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "pincode_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create partner_channel_configs table
CREATE TABLE "partner_channel_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" TEXT NOT NULL,
    "channel_name" VARCHAR(100) NOT NULL,
    "api_url" VARCHAR(500) NOT NULL,
    "api_key" VARCHAR(500) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_channel_configs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for partner_channel_configs
CREATE UNIQUE INDEX "partner_channel_configs_partner_id_channel_name_key" ON "partner_channel_configs"("partner_id", "channel_name");
CREATE INDEX "partner_channel_configs_partner_id_is_active_idx" ON "partner_channel_configs"("partner_id", "is_active");
CREATE INDEX "partner_channel_configs_partner_id_is_primary_idx" ON "partner_channel_configs"("partner_id", "is_primary");

-- Add foreign key constraint
ALTER TABLE "partner_channel_configs" ADD CONSTRAINT "partner_channel_configs_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create pincode_type_service_charges table
CREATE TABLE "pincode_type_service_charges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pincode_type_id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "base_charge" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pincode_type_service_charges_pkey" PRIMARY KEY ("id")
);

-- Create indexes for pincode_type_service_charges
CREATE UNIQUE INDEX "pincode_type_service_charges_pincode_type_id_partner_id_key" ON "pincode_type_service_charges"("pincode_type_id", "partner_id");
CREATE INDEX "pincode_type_service_charges_pincode_type_id_idx" ON "pincode_type_service_charges"("pincode_type_id");
CREATE INDEX "pincode_type_service_charges_partner_id_idx" ON "pincode_type_service_charges"("partner_id");
CREATE INDEX "pincode_type_service_charges_is_active_idx" ON "pincode_type_service_charges"("is_active");

-- Add foreign key constraints
ALTER TABLE "pincode_type_service_charges" ADD CONSTRAINT "pincode_type_service_charges_pincode_type_id_fkey" FOREIGN KEY ("pincode_type_id") REFERENCES "pincode_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pincode_type_service_charges" ADD CONSTRAINT "pincode_type_service_charges_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
