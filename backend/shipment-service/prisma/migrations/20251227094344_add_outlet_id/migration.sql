-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "outlet_id" UUID;

-- CreateIndex
CREATE INDEX "shipments_outlet_id_status_created_at_idx" ON "shipments"("outlet_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "shipments_outlet_id_idx" ON "shipments"("outlet_id");
