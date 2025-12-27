-- AlterTable
ALTER TABLE "charge_packages" ADD COLUMN     "customer_id" UUID;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "customer_id" UUID;

-- AlterTable
ALTER TABLE "zones" ADD COLUMN     "customer_id" UUID;

-- CreateIndex
CREATE INDEX "charge_packages_customer_id_is_active_idx" ON "charge_packages"("customer_id", "is_active");

-- CreateIndex
CREATE INDEX "charge_packages_customer_id_idx" ON "charge_packages"("customer_id");

-- CreateIndex
CREATE INDEX "partners_customer_id_isActive_idx" ON "partners"("customer_id", "isActive");

-- CreateIndex
CREATE INDEX "partners_customer_id_idx" ON "partners"("customer_id");

-- CreateIndex
CREATE INDEX "zones_customer_id_status_idx" ON "zones"("customer_id", "status");

-- CreateIndex
CREATE INDEX "zones_customer_id_idx" ON "zones"("customer_id");

-- RenameIndex
ALTER INDEX "zones_zoneType_idx" RENAME TO "zones_zone_type_idx";
