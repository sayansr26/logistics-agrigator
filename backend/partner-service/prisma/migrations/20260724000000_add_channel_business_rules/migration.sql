-- CreateEnum
CREATE TYPE "ChannelBusinessType" AS ENUM ('B2B', 'B2C', 'BOTH');

-- AlterTable
ALTER TABLE "partner_service_channels" ADD COLUMN     "business_type" "ChannelBusinessType" NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "max_order_amount" DECIMAL(12,2),
ADD COLUMN     "min_order_amount" DECIMAL(12,2),
ADD COLUMN     "payment_modes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "partner_shipments" ADD COLUMN     "service_channel_id" UUID;

-- CreateIndex
CREATE INDEX "partner_service_channels_partner_id_business_type_is_active_idx" ON "partner_service_channels"("partner_id", "business_type", "is_active");

-- AddForeignKey
ALTER TABLE "partner_shipments" ADD CONSTRAINT "partner_shipments_service_channel_id_fkey" FOREIGN KEY ("service_channel_id") REFERENCES "partner_service_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

