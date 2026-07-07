-- CreateEnum
CREATE TYPE "CarrierServiceType" AS ENUM ('SURFACE', 'AIR', 'EXPRESS');
-- CreateTable
CREATE TABLE "partner_service_channels" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "channel_config_id" UUID,
    "channel_name" VARCHAR(150) NOT NULL,
    "account_ref" VARCHAR(100) NOT NULL,
    "service_type" "CarrierServiceType" NOT NULL DEFAULT 'SURFACE',
    "min_weight" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "max_weight" DECIMAL(8,3),
    "credentials" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "partner_service_channels_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "partner_service_channels_partner_id_is_active_idx" ON "partner_service_channels"("partner_id", "is_active");
-- CreateIndex
CREATE INDEX "partner_service_channels_partner_id_service_type_is_active_idx" ON "partner_service_channels"("partner_id", "service_type", "is_active");
-- CreateIndex
CREATE UNIQUE INDEX "partner_service_channels_partner_id_channel_name_key" ON "partner_service_channels"("partner_id", "channel_name");
-- AddForeignKey
ALTER TABLE "partner_service_channels" ADD CONSTRAINT "partner_service_channels_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "partner_service_channels" ADD CONSTRAINT "partner_service_channels_channel_config_id_fkey" FOREIGN KEY ("channel_config_id") REFERENCES "partner_channel_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
