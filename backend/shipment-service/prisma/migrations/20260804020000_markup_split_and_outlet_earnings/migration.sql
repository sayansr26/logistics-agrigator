-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "cod_base_amount" DECIMAL(10,2),
ADD COLUMN     "markup_amount" DECIMAL(10,2),
ADD COLUMN     "markup_type" VARCHAR(12),
ADD COLUMN     "markup_value" DECIMAL(10,2),
ADD COLUMN     "system_charge" DECIMAL(10,2),
ADD COLUMN     "vas_selections" JSONB;

-- CreateTable
CREATE TABLE "outlet_earnings" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "client_id" UUID,
    "markup_type" VARCHAR(12) NOT NULL,
    "markup_value" DECIMAL(10,2) NOT NULL,
    "system_charge" DECIMAL(10,2) NOT NULL,
    "markup_amount" DECIMAL(10,2) NOT NULL,
    "status" VARCHAR(12) NOT NULL DEFAULT 'ACCRUED',
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlet_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outlet_earnings_shipment_id_key" ON "outlet_earnings"("shipment_id");

-- CreateIndex
CREATE INDEX "outlet_earnings_outlet_id_status_created_at_idx" ON "outlet_earnings"("outlet_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "outlet_earnings_client_id_created_at_idx" ON "outlet_earnings"("client_id", "created_at");

-- AddForeignKey
ALTER TABLE "outlet_earnings" ADD CONSTRAINT "outlet_earnings_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

