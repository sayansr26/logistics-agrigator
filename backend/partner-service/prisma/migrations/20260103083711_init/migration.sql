-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('DISTANCE', 'GEOLOGICAL');

-- CreateEnum
CREATE TYPE "ChargePackageType" AS ENUM ('WEIGHT', 'DISTANCE', 'GENERIC');

-- CreateEnum
CREATE TYPE "ChargePackageCalcType" AS ENUM ('FLAT', 'PERCENTAGE_OF_COD', 'PERCENTAGE_OF_DECLARED_VALUE');

-- CreateEnum
CREATE TYPE "ChargePackageAppliesTo" AS ENUM ('ANY', 'COD', 'PREPAID');

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "apiUrl" TEXT NOT NULL,
    "apiToken" TEXT,
    "apiVersion" TEXT,
    "supportsCOD" BOOLEAN NOT NULL DEFAULT false,
    "supportsReverse" BOOLEAN NOT NULL DEFAULT false,
    "minWeight" DOUBLE PRECISION,
    "maxWeight" DOUBLE PRECISION,
    "maxDimensions" JSONB,
    "baseRate" DOUBLE PRECISION,
    "perKgRate" DOUBLE PRECISION,
    "codChargePercent" DOUBLE PRECISION,
    "fuelSurcharge" DOUBLE PRECISION,
    "default_delivery_days" INTEGER,
    "servicePincodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_rates" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "fromPincode" TEXT NOT NULL,
    "toPincode" TEXT NOT NULL,
    "zone" TEXT,
    "minWeight" DOUBLE PRECISION NOT NULL,
    "maxWeight" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "codCharge" DOUBLE PRECISION,
    "fuelSurcharge" DOUBLE PRECISION,
    "serviceType" TEXT NOT NULL,
    "deliveryDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_shipments" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "partnerAwbNo" TEXT,
    "status" TEXT NOT NULL,
    "trackingUrl" TEXT,
    "calculatedRate" DOUBLE PRECISION,
    "actualRate" DOUBLE PRECISION,
    "codAmount" DOUBLE PRECISION,
    "serviceType" TEXT NOT NULL,
    "expectedDelivery" TIMESTAMP(3),
    "actualDelivery" TIMESTAMP(3),
    "pickupDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serviceability_cache" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "fromPincode" TEXT NOT NULL,
    "toPincode" TEXT NOT NULL,
    "isServiceable" BOOLEAN NOT NULL,
    "serviceType" TEXT,
    "deliveryDays" INTEGER,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "serviceability_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestData" JSONB,
    "responseData" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "states" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "stateId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(10),
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "cityId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(10),
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pincodes" (
    "id" UUID NOT NULL,
    "areaId" UUID,
    "stateId" UUID NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "areaName" VARCHAR(255),
    "district" VARCHAR(255),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "odaApplicable" BOOLEAN NOT NULL DEFAULT false,
    "hillApplicable" BOOLEAN NOT NULL DEFAULT false,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pincodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "zone_type" "ZoneType" NOT NULL DEFAULT 'GEOLOGICAL',
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_states" (
    "id" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "stateId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_cities" (
    "id" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "cityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_areas" (
    "id" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_pincodes" (
    "id" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "pincodeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_pincodes_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "pincode_types" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "charge" DECIMAL(10,2) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pincode_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pincode_type_assignments" (
    "id" UUID NOT NULL,
    "pincode_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "pincode_type_assignments_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "partners_name_key" ON "partners"("name");

-- CreateIndex
CREATE UNIQUE INDEX "partners_code_key" ON "partners"("code");

-- CreateIndex
CREATE INDEX "partners_isActive_idx" ON "partners"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "partner_rates_partnerId_fromPincode_toPincode_minWeight_max_key" ON "partner_rates"("partnerId", "fromPincode", "toPincode", "minWeight", "maxWeight", "serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "partner_shipments_shipmentId_key" ON "partner_shipments"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_shipments_partnerAwbNo_key" ON "partner_shipments"("partnerAwbNo");

-- CreateIndex
CREATE UNIQUE INDEX "serviceability_cache_partnerId_fromPincode_toPincode_key" ON "serviceability_cache"("partnerId", "fromPincode", "toPincode");

-- CreateIndex
CREATE UNIQUE INDEX "states_code_key" ON "states"("code");

-- CreateIndex
CREATE INDEX "states_code_status_idx" ON "states"("code", "status");

-- CreateIndex
CREATE INDEX "cities_stateId_status_idx" ON "cities"("stateId", "status");

-- CreateIndex
CREATE INDEX "cities_code_idx" ON "cities"("code");

-- CreateIndex
CREATE INDEX "areas_cityId_status_idx" ON "areas"("cityId", "status");

-- CreateIndex
CREATE INDEX "areas_code_idx" ON "areas"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pincodes_code_key" ON "pincodes"("code");

-- CreateIndex
CREATE INDEX "pincodes_code_status_idx" ON "pincodes"("code", "status");

-- CreateIndex
CREATE INDEX "pincodes_areaId_status_idx" ON "pincodes"("areaId", "status");

-- CreateIndex
CREATE INDEX "pincodes_stateId_status_idx" ON "pincodes"("stateId", "status");

-- CreateIndex
CREATE INDEX "pincodes_latitude_longitude_idx" ON "pincodes"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "zones_partnerId_status_idx" ON "zones"("partnerId", "status");

-- CreateIndex
CREATE INDEX "zones_zone_type_idx" ON "zones"("zone_type");

-- CreateIndex
CREATE UNIQUE INDEX "zones_partnerId_name_key" ON "zones"("partnerId", "name");

-- CreateIndex
CREATE INDEX "zone_states_zoneId_idx" ON "zone_states"("zoneId");

-- CreateIndex
CREATE INDEX "zone_states_stateId_idx" ON "zone_states"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "zone_states_zoneId_stateId_key" ON "zone_states"("zoneId", "stateId");

-- CreateIndex
CREATE INDEX "zone_cities_zoneId_idx" ON "zone_cities"("zoneId");

-- CreateIndex
CREATE INDEX "zone_cities_cityId_idx" ON "zone_cities"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "zone_cities_zoneId_cityId_key" ON "zone_cities"("zoneId", "cityId");

-- CreateIndex
CREATE INDEX "zone_areas_zoneId_idx" ON "zone_areas"("zoneId");

-- CreateIndex
CREATE INDEX "zone_areas_areaId_idx" ON "zone_areas"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "zone_areas_zoneId_areaId_key" ON "zone_areas"("zoneId", "areaId");

-- CreateIndex
CREATE INDEX "zone_pincodes_zoneId_idx" ON "zone_pincodes"("zoneId");

-- CreateIndex
CREATE INDEX "zone_pincodes_pincodeId_idx" ON "zone_pincodes"("pincodeId");

-- CreateIndex
CREATE UNIQUE INDEX "zone_pincodes_zoneId_pincodeId_key" ON "zone_pincodes"("zoneId", "pincodeId");

-- CreateIndex
CREATE INDEX "zone_milestones_zone_id_idx" ON "zone_milestones"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "zone_milestones_zone_id_sort_order_key" ON "zone_milestones"("zone_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "zone_milestones_zone_id_min_km_key" ON "zone_milestones"("zone_id", "min_km");

-- CreateIndex
CREATE UNIQUE INDEX "zone_milestones_zone_id_max_km_key" ON "zone_milestones"("zone_id", "max_km");

-- CreateIndex
CREATE INDEX "pincode_types_partner_id_is_active_idx" ON "pincode_types"("partner_id", "is_active");

-- CreateIndex
CREATE INDEX "pincode_types_partner_id_name_idx" ON "pincode_types"("partner_id", "name");

-- CreateIndex
CREATE INDEX "pincode_types_is_active_idx" ON "pincode_types"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pincode_types_partner_id_name_key" ON "pincode_types"("partner_id", "name");

-- CreateIndex
CREATE INDEX "pincode_type_assignments_pincode_id_idx" ON "pincode_type_assignments"("pincode_id");

-- CreateIndex
CREATE INDEX "pincode_type_assignments_type_id_idx" ON "pincode_type_assignments"("type_id");

-- CreateIndex
CREATE UNIQUE INDEX "pincode_type_assignments_pincode_id_type_id_key" ON "pincode_type_assignments"("pincode_id", "type_id");

-- CreateIndex
CREATE INDEX "charge_packages_partner_id_is_active_idx" ON "charge_packages"("partner_id", "is_active");

-- CreateIndex
CREATE INDEX "charge_packages_type_idx" ON "charge_packages"("type");

-- CreateIndex
CREATE UNIQUE INDEX "charge_packages_partner_id_name_key" ON "charge_packages"("partner_id", "name");

-- AddForeignKey
ALTER TABLE "partner_rates" ADD CONSTRAINT "partner_rates_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_shipments" ADD CONSTRAINT "partner_shipments_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceability_cache" ADD CONSTRAINT "serviceability_cache_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pincodes" ADD CONSTRAINT "pincodes_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pincodes" ADD CONSTRAINT "pincodes_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_states" ADD CONSTRAINT "zone_states_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_states" ADD CONSTRAINT "zone_states_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_cities" ADD CONSTRAINT "zone_cities_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_cities" ADD CONSTRAINT "zone_cities_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_areas" ADD CONSTRAINT "zone_areas_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_areas" ADD CONSTRAINT "zone_areas_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_pincodes" ADD CONSTRAINT "zone_pincodes_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_pincodes" ADD CONSTRAINT "zone_pincodes_pincodeId_fkey" FOREIGN KEY ("pincodeId") REFERENCES "pincodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_milestones" ADD CONSTRAINT "zone_milestones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pincode_types" ADD CONSTRAINT "pincode_types_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pincode_type_assignments" ADD CONSTRAINT "pincode_type_assignments_pincode_id_fkey" FOREIGN KEY ("pincode_id") REFERENCES "pincodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pincode_type_assignments" ADD CONSTRAINT "pincode_type_assignments_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "pincode_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_packages" ADD CONSTRAINT "charge_packages_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
