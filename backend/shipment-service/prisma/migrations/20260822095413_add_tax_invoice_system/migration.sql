-- CreateTable
CREATE TABLE "invoice_counters" (
    "id" UUID NOT NULL,
    "financial_year" VARCHAR(10) NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "invoice_type" VARCHAR(20) NOT NULL DEFAULT 'TAX_INVOICE',
    "invoice_number" VARCHAR(50) NOT NULL,
    "financial_year" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "original_invoice_id" UUID,
    "financial_adjustment_id" UUID,
    "outlet_id" UUID,
    "client_id" UUID,
    "billed_name" VARCHAR(200) NOT NULL,
    "billed_gstin" VARCHAR(20),
    "billed_address_line1" VARCHAR(255),
    "billed_address_line2" VARCHAR(255),
    "billed_city" VARCHAR(100),
    "billed_state" VARCHAR(50),
    "billed_state_code" VARCHAR(2),
    "billed_pincode" VARCHAR(6),
    "place_of_supply_state" VARCHAR(50) NOT NULL,
    "place_of_supply_state_code" VARCHAR(2) NOT NULL,
    "supply_type" VARCHAR(10) NOT NULL,
    "taxable_value" DECIMAL(12,2) NOT NULL,
    "cgst_rate" DECIMAL(5,2),
    "cgst_amount" DECIMAL(12,2),
    "sgst_rate" DECIMAL(5,2),
    "sgst_amount" DECIMAL(12,2),
    "igst_rate" DECIMAL(5,2),
    "igst_amount" DECIMAL(12,2),
    "total_amount" DECIMAL(12,2) NOT NULL,
    "hsn_sac_code" VARCHAR(10) NOT NULL DEFAULT '996812',
    "line_items" JSONB NOT NULL,
    "pdf_url" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_counters_financial_year_key" ON "invoice_counters"("financial_year");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_shipment_id_idx" ON "invoices"("shipment_id");

-- CreateIndex
CREATE INDEX "invoices_financial_year_invoice_number_idx" ON "invoices"("financial_year", "invoice_number");

-- CreateIndex
CREATE INDEX "invoices_outlet_id_idx" ON "invoices"("outlet_id");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_original_invoice_id_idx" ON "invoices"("original_invoice_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

