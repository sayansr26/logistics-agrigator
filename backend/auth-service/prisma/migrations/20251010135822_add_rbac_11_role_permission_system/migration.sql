-- RBAC-001: Add 11-Role RBAC System with Permission Models
-- This migration implements comprehensive role-based access control

-- Step 1: Create new enums (if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccessLevel') THEN
        CREATE TYPE "AccessLevel" AS ENUM ('FULL', 'RESTRICTED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommissionType') THEN
        CREATE TYPE "CommissionType" AS ENUM ('FLAT', 'PERCENTAGE');
    END IF;
END $$;

-- Step 2: Alter Role enum to add new roles (simpler approach without checking)
-- PostgreSQL will skip if values already exist
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'superadmin';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'accounts';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer_account';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer_sales';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'customer_support';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'affiliate';

-- Step 3: Add new columns to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "parent_client_id" UUID,
  ADD COLUMN IF NOT EXISTS "parent_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "access_level" "AccessLevel" DEFAULT 'FULL',
  ADD COLUMN IF NOT EXISTS "assigned_customer_ids" UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "license_id" UUID,
  ADD COLUMN IF NOT EXISTS "is_license_active" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "license_valid_until" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "commission_rate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "commission_type" "CommissionType";

-- Step 4: Create indexes for new user columns
CREATE INDEX IF NOT EXISTS "users_parent_client_id_idx" ON "users"("parent_client_id");
CREATE INDEX IF NOT EXISTS "users_license_id_idx" ON "users"("license_id");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");

-- Step 5: Create permissions table
CREATE TABLE IF NOT EXISTS "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "scope" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- Step 6: Create unique constraint and indexes for permissions
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_module_action_scope_key" ON "permissions"("module", "action", "scope");
CREATE INDEX IF NOT EXISTS "permissions_module_idx" ON "permissions"("module");
CREATE INDEX IF NOT EXISTS "permissions_is_active_idx" ON "permissions"("is_active");

-- Step 7: Create role_permissions table
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "Role" NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- Step 8: Create unique constraint and indexes for role_permissions
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_permission_id_key" ON "role_permissions"("role", "permission_id");
CREATE INDEX IF NOT EXISTS "role_permissions_role_idx" ON "role_permissions"("role");

-- Step 9: Create user_permissions table
CREATE TABLE IF NOT EXISTS "user_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "is_granted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- Step 10: Create unique constraint and indexes for user_permissions
CREATE UNIQUE INDEX IF NOT EXISTS "user_permissions_user_id_permission_id_key" ON "user_permissions"("user_id", "permission_id");
CREATE INDEX IF NOT EXISTS "user_permissions_user_id_idx" ON "user_permissions"("user_id");

-- Step 11: Add foreign key constraints
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 12: Create trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 13: Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_permissions_updated_at ON "permissions";
CREATE TRIGGER update_permissions_updated_at
    BEFORE UPDATE ON "permissions"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON "user_permissions";
CREATE TRIGGER update_user_permissions_updated_at
    BEFORE UPDATE ON "user_permissions"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration completed successfully
-- RBAC system with 11 roles and permission models is now active
