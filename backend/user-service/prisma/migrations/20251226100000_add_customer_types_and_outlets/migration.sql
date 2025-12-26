-- Migration: Add CustomerType enum and outlet fields to Customer model
-- This migration introduces DIRECT vs OUTLET customer types

-- 1. Create CustomerType enum
CREATE TYPE "CustomerType" AS ENUM ('DIRECT', 'OUTLET');

-- 2. Add new columns to customers table
ALTER TABLE "customers" ADD COLUMN "customer_type" "CustomerType" NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "customers" ADD COLUMN "outlet_code" VARCHAR(50);
ALTER TABLE "customers" ADD COLUMN "outlet_name" VARCHAR(200);
ALTER TABLE "customers" ADD COLUMN "retailer_name" VARCHAR(200);
ALTER TABLE "customers" ADD COLUMN "contact_person" VARCHAR(100);
ALTER TABLE "customers" ADD COLUMN "outlet_status" VARCHAR(20);
ALTER TABLE "customers" ADD COLUMN "outlet_type" VARCHAR(50);
ALTER TABLE "customers" ADD COLUMN "business_hours" VARCHAR(255);
ALTER TABLE "customers" ADD COLUMN "gst_number" VARCHAR(20);
ALTER TABLE "customers" ADD COLUMN "pan_number" VARCHAR(20);
ALTER TABLE "customers" ADD COLUMN "bank_details" JSONB;
ALTER TABLE "customers" ADD COLUMN "assigned_couriers" TEXT[] DEFAULT '{}';
ALTER TABLE "customers" ADD COLUMN "service_areas" TEXT[] DEFAULT '{}';
ALTER TABLE "customers" ADD COLUMN "address" VARCHAR(500);
ALTER TABLE "customers" ADD COLUMN "city" VARCHAR(100);
ALTER TABLE "customers" ADD COLUMN "state" VARCHAR(100);
ALTER TABLE "customers" ADD COLUMN "pincode" VARCHAR(10);
ALTER TABLE "customers" ADD COLUMN "country" VARCHAR(100) DEFAULT 'India';

-- 3. Make clientId optional (nullable) for direct customers
ALTER TABLE "customers" ALTER COLUMN "client_id" DROP NOT NULL;

-- 4. Drop the old unique constraint (clientId, email)
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_client_id_email_key";

-- 5. Create partial unique indexes for email uniqueness
-- When clientId IS NULL: email must be unique globally among direct customers
CREATE UNIQUE INDEX "customers_email_direct_unique" 
  ON "customers" ("email") 
  WHERE "client_id" IS NULL;

-- When clientId IS NOT NULL: email must be unique per client
CREATE UNIQUE INDEX "customers_client_email_unique" 
  ON "customers" ("client_id", "email") 
  WHERE "client_id" IS NOT NULL;

-- 6. Create unique index for outlet_code (must be globally unique when not null)
CREATE UNIQUE INDEX "customers_outlet_code_key" 
  ON "customers" ("outlet_code") 
  WHERE "outlet_code" IS NOT NULL;

-- 7. Create index on customer_type for faster filtering
CREATE INDEX "customers_customer_type_idx" ON "customers" ("customer_type");

