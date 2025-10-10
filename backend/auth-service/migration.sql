-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('admin', 'finance', 'operations', 'client', 'support');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_permission_id_fkey";

-- DropIndex
DROP INDEX "users_client_id_idx";

-- DropIndex
DROP INDEX "users_parent_client_id_idx";

-- DropIndex
DROP INDEX "users_license_id_idx";

-- DropIndex
DROP INDEX "users_role_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "access_level",
DROP COLUMN "assigned_customer_ids",
DROP COLUMN "commission_rate",
DROP COLUMN "commission_type",
DROP COLUMN "is_license_active",
DROP COLUMN "license_id",
DROP COLUMN "license_valid_until",
DROP COLUMN "parent_client_id",
DROP COLUMN "parent_user_id",
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- DropTable
DROP TABLE "permissions";

-- DropTable
DROP TABLE "role_permissions";

-- DropTable
DROP TABLE "user_permissions";

-- DropEnum
DROP TYPE "AccessLevel";

-- DropEnum
DROP TYPE "CommissionType";

