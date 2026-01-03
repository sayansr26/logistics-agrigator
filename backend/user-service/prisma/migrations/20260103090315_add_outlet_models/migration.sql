-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'outlet';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "outlet_id" UUID;

-- CreateTable
CREATE TABLE "outlets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "company_name" VARCHAR(200),
    "category" VARCHAR(100),
    "tan_pan" VARCHAR(50),
    "gst" VARCHAR(50),
    "company_address" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_addresses" (
    "id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "address_type" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "address_line1" VARCHAR(255) NOT NULL,
    "address_line2" VARCHAR(255),
    "landmark" VARCHAR(100),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "is_default_pickup" BOOLEAN NOT NULL DEFAULT false,
    "is_default_return" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlet_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outlets_user_id_key" ON "outlets"("user_id");

-- CreateIndex
CREATE INDEX "outlets_user_id_idx" ON "outlets"("user_id");

-- CreateIndex
CREATE INDEX "outlets_client_id_idx" ON "outlets"("client_id");

-- CreateIndex
CREATE INDEX "outlets_created_by_user_id_idx" ON "outlets"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "outlets_client_id_email_key" ON "outlets"("client_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "outlets_client_id_phone_key" ON "outlets"("client_id", "phone");

-- CreateIndex
CREATE INDEX "outlet_addresses_outlet_id_idx" ON "outlet_addresses"("outlet_id");

-- CreateIndex
CREATE INDEX "outlet_addresses_is_default_pickup_idx" ON "outlet_addresses"("is_default_pickup");

-- CreateIndex
CREATE INDEX "outlet_addresses_is_default_return_idx" ON "outlet_addresses"("is_default_return");

-- CreateIndex
CREATE INDEX "audit_logs_outlet_id_idx" ON "audit_logs"("outlet_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_addresses" ADD CONSTRAINT "outlet_addresses_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
