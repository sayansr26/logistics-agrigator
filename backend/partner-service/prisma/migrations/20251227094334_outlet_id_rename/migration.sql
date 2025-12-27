/*
  Warnings:

  - You are about to drop the column `customer_id` on the `charge_packages` table. All the data in the column will be lost.
  - You are about to drop the column `customer_id` on the `partners` table. All the data in the column will be lost.
  - You are about to drop the column `customer_id` on the `zones` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "charge_packages_customer_id_idx";

-- DropIndex
DROP INDEX "charge_packages_customer_id_is_active_idx";

-- DropIndex
DROP INDEX "partners_customer_id_idx";

-- DropIndex
DROP INDEX "partners_customer_id_isActive_idx";

-- DropIndex
DROP INDEX "zones_customer_id_idx";

-- DropIndex
DROP INDEX "zones_customer_id_status_idx";

-- AlterTable
ALTER TABLE "charge_packages" DROP COLUMN "customer_id",
ADD COLUMN     "outlet_id" UUID;

-- AlterTable
ALTER TABLE "partners" DROP COLUMN "customer_id",
ADD COLUMN     "outlet_id" UUID;

-- AlterTable
ALTER TABLE "zones" DROP COLUMN "customer_id",
ADD COLUMN     "outlet_id" UUID;

-- CreateIndex
CREATE INDEX "charge_packages_outlet_id_is_active_idx" ON "charge_packages"("outlet_id", "is_active");

-- CreateIndex
CREATE INDEX "charge_packages_outlet_id_idx" ON "charge_packages"("outlet_id");

-- CreateIndex
CREATE INDEX "partners_outlet_id_isActive_idx" ON "partners"("outlet_id", "isActive");

-- CreateIndex
CREATE INDEX "partners_outlet_id_idx" ON "partners"("outlet_id");

-- CreateIndex
CREATE INDEX "zones_outlet_id_status_idx" ON "zones"("outlet_id", "status");

-- CreateIndex
CREATE INDEX "zones_outlet_id_idx" ON "zones"("outlet_id");
