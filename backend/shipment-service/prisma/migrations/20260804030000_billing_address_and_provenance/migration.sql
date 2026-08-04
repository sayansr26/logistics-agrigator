-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "billing_address_id" UUID,
ADD COLUMN     "billing_city" VARCHAR(50),
ADD COLUMN     "billing_country" VARCHAR(50) DEFAULT 'India',
ADD COLUMN     "billing_email" VARCHAR(255),
ADD COLUMN     "billing_landmark" VARCHAR(100),
ADD COLUMN     "billing_line1" VARCHAR(255),
ADD COLUMN     "billing_line2" VARCHAR(255),
ADD COLUMN     "billing_name" VARCHAR(100),
ADD COLUMN     "billing_phone" VARCHAR(15),
ADD COLUMN     "billing_pincode" VARCHAR(6),
ADD COLUMN     "billing_same_as_delivery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "billing_state" VARCHAR(50),
ADD COLUMN     "delivery_address_id" UUID,
ADD COLUMN     "rto_address_id" UUID;

