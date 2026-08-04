-- AlterTable
ALTER TABLE "outlets" ADD COLUMN     "default_markup_type" VARCHAR(12),
ADD COLUMN     "default_markup_value" DECIMAL(10,2),
ADD COLUMN     "max_markup_flat" DECIMAL(10,2),
ADD COLUMN     "max_markup_percent" DECIMAL(5,2);

