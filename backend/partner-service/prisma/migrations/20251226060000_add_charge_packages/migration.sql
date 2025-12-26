-- CreateEnum
CREATE TYPE "ChargePackageType" AS ENUM ('WEIGHT', 'DISTANCE', 'GENERIC');

-- CreateEnum
CREATE TYPE "ChargePackageCalcType" AS ENUM ('FLAT', 'PERCENTAGE_OF_COD', 'PERCENTAGE_OF_DECLARED_VALUE');

-- CreateEnum
CREATE TYPE "ChargePackageAppliesTo" AS ENUM ('ANY', 'COD', 'PREPAID');

-- AlterTable: Add defaultDeliveryDays to partners
ALTER TABLE "partners" ADD COLUMN "default_delivery_days" INTEGER;

-- CreateTable
CREATE TABLE "charge_packages" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "ChargePackageType" NOT NULL,
    "base_charge" DECIMAL(10,2) NOT NULL,
    "base_unit" DECIMAL(10,2),
    "addon_unit" DECIMAL(10,2),
    "addon_charge" DECIMAL(10,2),
    "applies_to" "ChargePackageAppliesTo" NOT NULL DEFAULT 'ANY',
    "calc_type" "ChargePackageCalcType" NOT NULL DEFAULT 'FLAT',
    "metadata" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "charge_packages_partner_id_is_active_idx" ON "charge_packages"("partner_id", "is_active");

-- CreateIndex
CREATE INDEX "charge_packages_type_idx" ON "charge_packages"("type");

-- CreateIndex
CREATE UNIQUE INDEX "charge_packages_partner_id_name_key" ON "charge_packages"("partner_id", "name");

-- AddForeignKey
ALTER TABLE "charge_packages" ADD CONSTRAINT "charge_packages_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

