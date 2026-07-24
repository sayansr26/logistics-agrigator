-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "courier_channel_id" UUID,
ADD COLUMN     "courier_channel_name" VARCHAR(150);

