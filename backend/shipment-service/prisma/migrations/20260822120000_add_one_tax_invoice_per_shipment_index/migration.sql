-- Enforce at most one ISSUED TAX_INVOICE per shipment, atomically, at the
-- DB level. This is a partial unique index scoped to
-- (invoice_type = 'TAX_INVOICE' AND status = 'ISSUED') rather than a plain
-- @@unique([shipmentId, invoiceType]) constraint, because a shipment can
-- legitimately have multiple CREDIT_NOTE / DEBIT_NOTE rows referencing the
-- same shipment_id (one per re-rate correction), and can also have
-- CANCELLED tax invoices co-existing with the one currently ISSUED one.
-- Prisma's schema.prisma does not support partial (WHERE-clause) unique
-- indexes as of prisma 5.22, so this is expressed as raw migration DDL
-- (not app-code raw SQL - the "Prisma ORM only" rule governs query code in
-- controllers/services, not migration files).
CREATE UNIQUE INDEX "invoices_one_tax_invoice_per_shipment"
ON "invoices" ("shipment_id")
WHERE "invoice_type" = 'TAX_INVOICE' AND "status" = 'ISSUED';
