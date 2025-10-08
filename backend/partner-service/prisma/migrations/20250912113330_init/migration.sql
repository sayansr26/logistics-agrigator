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
    "maxWeight" DOUBLE PRECISION,
    "maxDimensions" JSONB,
    "baseRate" DOUBLE PRECISION,
    "perKgRate" DOUBLE PRECISION,
    "codChargePercent" DOUBLE PRECISION,
    "fuelSurcharge" DOUBLE PRECISION,
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

-- CreateIndex
CREATE UNIQUE INDEX "partners_name_key" ON "partners"("name");

-- CreateIndex
CREATE UNIQUE INDEX "partners_code_key" ON "partners"("code");

-- CreateIndex
CREATE UNIQUE INDEX "partner_rates_partnerId_fromPincode_toPincode_minWeight_max_key" ON "partner_rates"("partnerId", "fromPincode", "toPincode", "minWeight", "maxWeight", "serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "partner_shipments_shipmentId_key" ON "partner_shipments"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_shipments_partnerAwbNo_key" ON "partner_shipments"("partnerAwbNo");

-- CreateIndex
CREATE UNIQUE INDEX "serviceability_cache_partnerId_fromPincode_toPincode_key" ON "serviceability_cache"("partnerId", "fromPincode", "toPincode");

-- AddForeignKey
ALTER TABLE "partner_rates" ADD CONSTRAINT "partner_rates_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_shipments" ADD CONSTRAINT "partner_shipments_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serviceability_cache" ADD CONSTRAINT "serviceability_cache_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
