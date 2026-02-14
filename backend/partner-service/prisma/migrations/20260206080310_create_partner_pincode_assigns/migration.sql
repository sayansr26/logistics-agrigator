-- CreateTable
CREATE TABLE "partner_pincode_assigns" (
    "id" UUID NOT NULL,
    "partner_id" TEXT NOT NULL,
    "pincode_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_pincode_assigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_pincode_type_values" (
    "id" UUID NOT NULL,
    "partner_pincode_id" UUID NOT NULL,
    "pincode_type_id" UUID NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_pincode_type_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_pincode_assigns_partner_id_pincode_id_key"
ON "partner_pincode_assigns"("partner_id", "pincode_id");

-- CreateIndex
CREATE INDEX "partner_pincode_assigns_partner_id_is_active_idx"
ON "partner_pincode_assigns"("partner_id", "is_active");

-- CreateIndex
CREATE INDEX "partner_pincode_assigns_pincode_id_idx"
ON "partner_pincode_assigns"("pincode_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_pincode_type_values_partner_pincode_id_pincode_type_id_key"
ON "partner_pincode_type_values"("partner_pincode_id", "pincode_type_id");

-- CreateIndex
CREATE INDEX "partner_pincode_type_values_partner_pincode_id_idx"
ON "partner_pincode_type_values"("partner_pincode_id");

-- CreateIndex
CREATE INDEX "partner_pincode_type_values_pincode_type_id_idx"
ON "partner_pincode_type_values"("pincode_type_id");

-- AddForeignKey
ALTER TABLE "partner_pincode_assigns"
ADD CONSTRAINT "partner_pincode_assigns_partner_id_fkey"
FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_pincode_assigns"
ADD CONSTRAINT "partner_pincode_assigns_pincode_id_fkey"
FOREIGN KEY ("pincode_id") REFERENCES "pincodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_pincode_type_values"
ADD CONSTRAINT "partner_pincode_type_values_partner_pincode_id_fkey"
FOREIGN KEY ("partner_pincode_id") REFERENCES "partner_pincode_assigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_pincode_type_values"
ADD CONSTRAINT "partner_pincode_type_values_pincode_type_id_fkey"
FOREIGN KEY ("pincode_type_id") REFERENCES "pincode_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
