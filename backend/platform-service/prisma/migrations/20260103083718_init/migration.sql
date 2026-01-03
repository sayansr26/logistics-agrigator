-- CreateEnum
CREATE TYPE "PlatformType" AS ENUM ('SHOPIFY', 'WOOCOMMERCE', 'MAGENTO', 'OPENCART', 'BIGCOMMERCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISCONNECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SyncType" AS ENUM ('FULL_SYNC', 'INCREMENTAL_SYNC', 'ORDER_SYNC', 'PRODUCT_SYNC', 'CUSTOMER_SYNC');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "platform_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platformType" "PlatformType" NOT NULL,
    "platformName" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_orders" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "platformOrderId" TEXT NOT NULL,
    "platformType" "PlatformType" NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerInfo" JSONB NOT NULL,
    "orderItems" JSONB NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "shippingAddress" JSONB NOT NULL,
    "shippingMethod" TEXT,
    "orderStatus" TEXT NOT NULL,
    "fulfillmentStatus" TEXT,
    "paymentStatus" TEXT,
    "shipmentId" TEXT,
    "trackingNumber" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "syncType" "SyncType" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsSuccess" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supported_platforms" (
    "id" TEXT NOT NULL,
    "type" "PlatformType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logoUrl" TEXT,
    "documentationUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiredFields" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supported_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_integrations_userId_platformType_platformName_key" ON "platform_integrations"("userId", "platformType", "platformName");

-- CreateIndex
CREATE UNIQUE INDEX "platform_orders_integrationId_platformOrderId_key" ON "platform_orders"("integrationId", "platformOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "supported_platforms_type_key" ON "supported_platforms"("type");

-- AddForeignKey
ALTER TABLE "platform_orders" ADD CONSTRAINT "platform_orders_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "platform_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "platform_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
