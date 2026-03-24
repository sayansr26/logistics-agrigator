-- Add provider sync metadata to shipments
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "provider_status" VARCHAR(50);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "provider_last_sync_at" TIMESTAMP(3);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "provider_raw_response" JSONB;

-- Add label/document metadata
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "courier_label_url" VARCHAR(500);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "courier_label_format" VARCHAR(20);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "courier_label_fetched_at" TIMESTAMP(3);

-- Add pickup metadata
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "pickup_request_id" VARCHAR(100);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "pickup_requested_at" TIMESTAMP(3);
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "pickup_confirmed_at" TIMESTAMP(3);

-- Create shipment_documents table
CREATE TABLE IF NOT EXISTS "shipment_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "url" VARCHAR(500),
    "data" TEXT,
    "format" VARCHAR(20),
    "source" VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    "metadata" JSONB,
    "fetched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shipment_documents_shipment_id_type_idx" ON "shipment_documents"("shipment_id", "type");

ALTER TABLE "shipment_documents" ADD CONSTRAINT "shipment_documents_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
