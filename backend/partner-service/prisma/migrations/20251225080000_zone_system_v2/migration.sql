-- Zone System v2 Migration
-- This migration:
-- 1. Drops the ServiceType system (service_types table)
-- 2. Drops the ZoneService system (zone_services table + ZoneServiceType enum)
-- 3. Adds ZoneType enum and zone_type column to zones
-- 4. Creates pincode_types and pincode_type_assignments tables
-- 5. Creates zone_milestones table

-- ==========================================
-- STEP 1: Clean slate - Delete existing zone-related data
-- ==========================================

-- Delete zone services first (references zones)
DELETE FROM "zone_services" WHERE 1=1;

-- Delete zone associations
DELETE FROM "zone_pincodes" WHERE 1=1;
DELETE FROM "zone_areas" WHERE 1=1;
DELETE FROM "zone_cities" WHERE 1=1;
DELETE FROM "zone_states" WHERE 1=1;

-- Delete zones
DELETE FROM "zones" WHERE 1=1;

-- Delete service types
DELETE FROM "service_types" WHERE 1=1;

-- ==========================================
-- STEP 2: Drop old tables and types
-- ==========================================

-- Drop zone_services table
DROP TABLE IF EXISTS "zone_services";

-- Drop service_types table
DROP TABLE IF EXISTS "service_types";

-- Drop ZoneServiceType enum
DROP TYPE IF EXISTS "ZoneServiceType";

-- ==========================================
-- STEP 3: Add ZoneType enum and column to zones
-- ==========================================

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('DISTANCE', 'GEOLOGICAL');

-- AddColumn with default value for existing rows
ALTER TABLE "zones" ADD COLUMN "zone_type" "ZoneType" NOT NULL DEFAULT 'GEOLOGICAL';

-- CreateIndex
CREATE INDEX "zones_zoneType_idx" ON "zones"("zone_type");

-- ==========================================
-- STEP 4: Create pincode_types table
-- ==========================================

-- CreateTable
CREATE TABLE "pincode_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "charge" DECIMAL(10,2) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pincode_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pincode_types_name_key" ON "pincode_types"("name");

-- CreateIndex
CREATE INDEX "pincode_types_name_idx" ON "pincode_types"("name");

-- CreateIndex
CREATE INDEX "pincode_types_is_active_idx" ON "pincode_types"("is_active");

-- ==========================================
-- STEP 5: Create pincode_type_assignments table
-- ==========================================

-- CreateTable
CREATE TABLE "pincode_type_assignments" (
    "id" UUID NOT NULL,
    "pincode_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "pincode_type_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pincode_type_assignments_pincode_id_idx" ON "pincode_type_assignments"("pincode_id");

-- CreateIndex
CREATE INDEX "pincode_type_assignments_type_id_idx" ON "pincode_type_assignments"("type_id");

-- CreateIndex
CREATE UNIQUE INDEX "pincode_type_assignments_pincode_id_type_id_key" ON "pincode_type_assignments"("pincode_id", "type_id");

-- AddForeignKey
ALTER TABLE "pincode_type_assignments" ADD CONSTRAINT "pincode_type_assignments_pincode_id_fkey" FOREIGN KEY ("pincode_id") REFERENCES "pincodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pincode_type_assignments" ADD CONSTRAINT "pincode_type_assignments_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "pincode_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================
-- STEP 6: Create zone_milestones table
-- ==========================================

-- CreateTable
CREATE TABLE "zone_milestones" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "min_km" INTEGER NOT NULL,
    "max_km" INTEGER NOT NULL,
    "suffix" VARCHAR(5) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zone_milestones_zone_id_idx" ON "zone_milestones"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "zone_milestones_zone_id_sort_order_key" ON "zone_milestones"("zone_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "zone_milestones_zone_id_min_km_key" ON "zone_milestones"("zone_id", "min_km");

-- CreateIndex
CREATE UNIQUE INDEX "zone_milestones_zone_id_max_km_key" ON "zone_milestones"("zone_id", "max_km");

-- AddForeignKey
ALTER TABLE "zone_milestones" ADD CONSTRAINT "zone_milestones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

