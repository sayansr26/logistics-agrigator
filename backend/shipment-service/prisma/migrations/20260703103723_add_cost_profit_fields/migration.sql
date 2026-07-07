-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "courier_cost" DECIMAL(10,2),
ADD COLUMN     "courier_cost_source" VARCHAR(20),
ADD COLUMN     "profit_margin" DECIMAL(10,2);
