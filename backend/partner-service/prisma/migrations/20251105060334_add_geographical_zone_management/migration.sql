-- CreateEnum
CREATE TYPE "ZoneServiceType" AS ENUM ('PICKUP', 'DELIVERY', 'COD', 'PREPAID', 'ODA', 'HILL');

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
CREATE TABLE "zone_services" (
    "id" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "serviceType" "ZoneServiceType" NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "additionalCharges" DECIMAL(10,2),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zone_services_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "zone_services_zoneId_serviceType_isAvailable_idx" ON "zone_services"("zoneId", "serviceType", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "zone_services_zoneId_serviceType_key" ON "zone_services"("zoneId", "serviceType");

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
ALTER TABLE "zone_services" ADD CONSTRAINT "zone_services_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
