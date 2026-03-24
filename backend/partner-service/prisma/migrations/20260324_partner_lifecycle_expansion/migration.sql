-- Add provider sync metadata to partner_shipments
ALTER TABLE "partner_shipments" ADD COLUMN IF NOT EXISTS "provider_status" VARCHAR(50);
ALTER TABLE "partner_shipments" ADD COLUMN IF NOT EXISTS "provider_last_sync_at" TIMESTAMP(3);
ALTER TABLE "partner_shipments" ADD COLUMN IF NOT EXISTS "provider_raw_response" JSONB;

-- Add label/document and pickup metadata
ALTER TABLE "partner_shipments" ADD COLUMN IF NOT EXISTS "courier_label_url" VARCHAR(500);
ALTER TABLE "partner_shipments" ADD COLUMN IF NOT EXISTS "pickup_request_id" VARCHAR(100);
ALTER TABLE "partner_shipments" ADD COLUMN IF NOT EXISTS "pickup_requested_at" TIMESTAMP(3);
