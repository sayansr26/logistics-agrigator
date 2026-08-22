-- Shipment snapshot on the invoice.
-- An invoice must be readable on its own: the recipient needs the order id,
-- AWB and route to tie the bill to a consignment. A shipment UUID does not
-- serve that purpose. Snapshotted at issue time, like the billed-to block, so
-- later edits to the shipment cannot alter an issued invoice.
ALTER TABLE "invoices"
  ADD COLUMN "order_id"            VARCHAR(100),
  ADD COLUMN "awb_number"          VARCHAR(50),
  ADD COLUMN "partner_name"        VARCHAR(100),
  ADD COLUMN "service_type"        VARCHAR(50),
  ADD COLUMN "shipment_date"       TIMESTAMP(3),
  ADD COLUMN "origin_city"         VARCHAR(100),
  ADD COLUMN "origin_pincode"      VARCHAR(6),
  ADD COLUMN "destination_city"    VARCHAR(100),
  ADD COLUMN "destination_pincode" VARCHAR(6),
  ADD COLUMN "chargeable_weight"   DECIMAL(10,3);
