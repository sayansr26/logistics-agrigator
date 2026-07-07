-- CreateEnum
CREATE TYPE "cod_collection_status" AS ENUM ('PENDING', 'COLLECTED', 'REMITTED');
-- CreateEnum
CREATE TYPE "cod_source" AS ENUM ('API', 'IMPORT', 'MANUAL');
-- CreateEnum
CREATE TYPE "recon_status" AS ENUM ('UNRECONCILED', 'MATCHED', 'MISSING', 'SHORT', 'EXCESS', 'DUPLICATE', 'MANUAL');
-- CreateEnum
CREATE TYPE "settlement_status" AS ENUM ('DRAFT', 'FINANCE_VERIFICATION', 'APPROVED', 'RELEASED', 'REJECTED', 'HOLD', 'CANCELLED');
-- CreateEnum
CREATE TYPE "settlement_payment_mode" AS ENUM ('WALLET_CREDIT', 'BANK_TRANSFER', 'UPI', 'MANUAL');
-- CreateEnum
CREATE TYPE "settlement_cycle" AS ENUM ('DAILY', 'WEEKLY', 'T_PLUS_1', 'T_PLUS_2');
-- CreateEnum
CREATE TYPE "adjustment_type" AS ENUM ('LOST', 'DAMAGE', 'SHORT_COD', 'EXCESS_COD', 'CREDIT_NOTE', 'DEBIT_NOTE', 'MANUAL');
-- CreateTable
CREATE TABLE "cod_shipments" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "awbNumber" VARCHAR(50) NOT NULL,
    "orderId" VARCHAR(100) NOT NULL,
    "invoiceNo" VARCHAR(100),
    "userId" UUID NOT NULL,
    "clientCode" VARCHAR(50) NOT NULL DEFAULT 'DEFAULT',
    "partnerId" VARCHAR(50),
    "partnerName" VARCHAR(100),
    "codAmount" DECIMAL(15,2) NOT NULL,
    "collectedAmount" DECIMAL(15,2),
    "collectionStatus" "cod_collection_status" NOT NULL DEFAULT 'PENDING',
    "reconStatus" "recon_status" NOT NULL DEFAULT 'UNRECONCILED',
    "deliveredAt" TIMESTAMPTZ,
    "settlementId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "cod_shipments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "cod_collections" (
    "id" UUID NOT NULL,
    "awbNumber" VARCHAR(50) NOT NULL,
    "reportedAmount" DECIMAL(15,2) NOT NULL,
    "collectionDate" TIMESTAMPTZ,
    "source" "cod_source" NOT NULL DEFAULT 'MANUAL',
    "courierReportId" VARCHAR(100),
    "matchedCodShipmentId" UUID,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMPTZ,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cod_collections_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "cod_reconciliations" (
    "id" UUID NOT NULL,
    "codShipmentId" UUID NOT NULL,
    "collectionId" UUID,
    "expectedAmount" DECIMAL(15,2) NOT NULL,
    "reportedAmount" DECIMAL(15,2),
    "variance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "recon_status" NOT NULL DEFAULT 'UNRECONCILED',
    "resolvedBy" UUID,
    "remarks" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "cod_reconciliations_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "settlementNo" VARCHAR(50) NOT NULL,
    "userId" UUID NOT NULL,
    "clientCode" VARCHAR(50) NOT NULL DEFAULT 'DEFAULT',
    "totalCod" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAdjustments" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "settlement_status" NOT NULL DEFAULT 'DRAFT',
    "paymentMode" "settlement_payment_mode",
    "cycle" "settlement_cycle",
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "releasedBy" UUID,
    "releasedAt" TIMESTAMPTZ,
    "rejectedReason" TEXT,
    "holdReason" TEXT,
    "remarks" TEXT,
    "payoutTransactionId" VARCHAR(100),
    "payoutReference" VARCHAR(200),
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "settlement_items" (
    "id" UUID NOT NULL,
    "settlementId" UUID NOT NULL,
    "codShipmentId" UUID NOT NULL,
    "awbNumber" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlement_items_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "settlement_adjustments" (
    "id" UUID NOT NULL,
    "settlementId" UUID,
    "userId" UUID,
    "clientCode" VARCHAR(50),
    "type" "adjustment_type" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceAwb" VARCHAR(50),
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlement_adjustments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "settlement_rules" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    "clientCode" VARCHAR(50),
    "userId" UUID,
    "partnerId" VARCHAR(50),
    "cycle" "settlement_cycle" NOT NULL DEFAULT 'T_PLUS_2',
    "paymentMode" "settlement_payment_mode" NOT NULL DEFAULT 'WALLET_CREDIT',
    "autoRelease" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "settlement_rules_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "cod_shipments_shipmentId_key" ON "cod_shipments"("shipmentId");
-- CreateIndex
CREATE INDEX "cod_shipments_awbNumber_idx" ON "cod_shipments"("awbNumber");
-- CreateIndex
CREATE INDEX "cod_shipments_userId_idx" ON "cod_shipments"("userId");
-- CreateIndex
CREATE INDEX "cod_shipments_clientCode_idx" ON "cod_shipments"("clientCode");
-- CreateIndex
CREATE INDEX "cod_shipments_collectionStatus_idx" ON "cod_shipments"("collectionStatus");
-- CreateIndex
CREATE INDEX "cod_shipments_reconStatus_idx" ON "cod_shipments"("reconStatus");
-- CreateIndex
CREATE INDEX "cod_shipments_settlementId_idx" ON "cod_shipments"("settlementId");
-- CreateIndex
CREATE INDEX "cod_collections_awbNumber_idx" ON "cod_collections"("awbNumber");
-- CreateIndex
CREATE INDEX "cod_collections_source_idx" ON "cod_collections"("source");
-- CreateIndex
CREATE INDEX "cod_collections_matchedCodShipmentId_idx" ON "cod_collections"("matchedCodShipmentId");
-- CreateIndex
CREATE INDEX "cod_collections_verified_idx" ON "cod_collections"("verified");
-- CreateIndex
CREATE INDEX "cod_reconciliations_codShipmentId_idx" ON "cod_reconciliations"("codShipmentId");
-- CreateIndex
CREATE INDEX "cod_reconciliations_status_idx" ON "cod_reconciliations"("status");
-- CreateIndex
CREATE UNIQUE INDEX "settlements_settlementNo_key" ON "settlements"("settlementNo");
-- CreateIndex
CREATE INDEX "settlements_userId_idx" ON "settlements"("userId");
-- CreateIndex
CREATE INDEX "settlements_clientCode_idx" ON "settlements"("clientCode");
-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");
-- CreateIndex
CREATE INDEX "settlements_createdAt_idx" ON "settlements"("createdAt");
-- CreateIndex
CREATE INDEX "settlement_items_settlementId_idx" ON "settlement_items"("settlementId");
-- CreateIndex
CREATE INDEX "settlement_items_codShipmentId_idx" ON "settlement_items"("codShipmentId");
-- CreateIndex
CREATE UNIQUE INDEX "settlement_items_settlementId_codShipmentId_key" ON "settlement_items"("settlementId", "codShipmentId");
-- CreateIndex
CREATE INDEX "settlement_adjustments_settlementId_idx" ON "settlement_adjustments"("settlementId");
-- CreateIndex
CREATE INDEX "settlement_adjustments_type_idx" ON "settlement_adjustments"("type");
-- CreateIndex
CREATE INDEX "settlement_adjustments_userId_idx" ON "settlement_adjustments"("userId");
-- CreateIndex
CREATE INDEX "settlement_rules_scope_isActive_idx" ON "settlement_rules"("scope", "isActive");
-- CreateIndex
CREATE INDEX "settlement_rules_userId_idx" ON "settlement_rules"("userId");
-- CreateIndex
CREATE INDEX "settlement_rules_partnerId_idx" ON "settlement_rules"("partnerId");
-- CreateIndex
CREATE INDEX "settlement_rules_clientCode_idx" ON "settlement_rules"("clientCode");
-- AddForeignKey
ALTER TABLE "cod_shipments" ADD CONSTRAINT "cod_shipments_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "cod_reconciliations" ADD CONSTRAINT "cod_reconciliations_codShipmentId_fkey" FOREIGN KEY ("codShipmentId") REFERENCES "cod_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "settlement_adjustments" ADD CONSTRAINT "settlement_adjustments_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
