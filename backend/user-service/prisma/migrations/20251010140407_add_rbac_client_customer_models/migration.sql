-- RBAC-001 Phase 2: Add Client/Customer Models for RBAC System
-- This migration implements license integration and customer hierarchy

-- Step 1: Create new enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientType') THEN
        CREATE TYPE "ClientType" AS ENUM ('STANDARD', 'LICENSE_BASED', 'RESELLER');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LicenseStatus') THEN
        CREATE TYPE "LicenseStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'SUSPENDED', 'EXPIRED');
    END IF;
END $$;

-- Step 2: Update Role enum to add new roles (if they don't exist)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'superadmin';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'accounts';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer_account';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer_sales';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer_support';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'affiliate';

-- Step 3: Add new columns to clients table
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "license_id" UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS "license_status" "LicenseStatus" DEFAULT 'INACTIVE',
  ADD COLUMN IF NOT EXISTS "license_valid_until" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "client_type" "ClientType" DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "docker_image_tag" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "deployed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activation_code" VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS "is_reseller" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "commission_rate" DOUBLE PRECISION;

-- Step 4: Create indexes for new client columns
CREATE INDEX IF NOT EXISTS "clients_license_id_idx" ON "clients"("license_id");
CREATE INDEX IF NOT EXISTS "clients_client_type_idx" ON "clients"("client_type");

-- Step 5: Add new columns to user_profiles table
ALTER TABLE "user_profiles"
  ADD COLUMN IF NOT EXISTS "customer_id" UUID,
  ADD COLUMN IF NOT EXISTS "customer_role" VARCHAR(50);

-- Step 6: Create index for customer_id in user_profiles
CREATE INDEX IF NOT EXISTS "user_profiles_customer_id_idx" ON "user_profiles"("customer_id");

-- Step 7: Create client_users table
CREATE TABLE IF NOT EXISTS "client_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "access_level" VARCHAR(20) NOT NULL DEFAULT 'FULL',
    "assigned_customer_ids" UUID[] DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_users_pkey" PRIMARY KEY ("id")
);

-- Step 8: Create unique constraint and indexes for client_users
CREATE UNIQUE INDEX IF NOT EXISTS "client_users_client_id_user_id_key" ON "client_users"("client_id", "user_id");
CREATE INDEX IF NOT EXISTS "client_users_client_id_idx" ON "client_users"("client_id");
CREATE INDEX IF NOT EXISTS "client_users_user_id_idx" ON "client_users"("user_id");

-- Step 9: Create customers table
CREATE TABLE IF NOT EXISTS "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "monthly_shipment_limit" INTEGER,
    "enabled_modules" TEXT[] DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- Step 10: Create unique constraint and indexes for customers
CREATE UNIQUE INDEX IF NOT EXISTS "customers_client_id_email_key" ON "customers"("client_id", "email");
CREATE INDEX IF NOT EXISTS "customers_client_id_idx" ON "customers"("client_id");
CREATE INDEX IF NOT EXISTS "customers_email_idx" ON "customers"("email");

-- Step 11: Create customer_users table
CREATE TABLE IF NOT EXISTS "customer_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "enabled_modules" TEXT[] DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_users_pkey" PRIMARY KEY ("id")
);

-- Step 12: Create unique constraint and indexes for customer_users
CREATE UNIQUE INDEX IF NOT EXISTS "customer_users_customer_id_user_id_key" ON "customer_users"("customer_id", "user_id");
CREATE INDEX IF NOT EXISTS "customer_users_customer_id_idx" ON "customer_users"("customer_id");
CREATE INDEX IF NOT EXISTS "customer_users_user_id_idx" ON "customer_users"("user_id");

-- Step 13: Add foreign key constraints
ALTER TABLE "client_users" ADD CONSTRAINT "client_users_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customers" ADD CONSTRAINT "customers_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_users" ADD CONSTRAINT "customer_users_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 14: Create trigger function for updated_at timestamps (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 15: Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_client_users_updated_at ON "client_users";
CREATE TRIGGER update_client_users_updated_at
    BEFORE UPDATE ON "client_users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON "customers";
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON "customers"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_users_updated_at ON "customer_users";
CREATE TRIGGER update_customer_users_updated_at
    BEFORE UPDATE ON "customer_users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration completed successfully
-- RBAC Client/Customer hierarchy is now active
