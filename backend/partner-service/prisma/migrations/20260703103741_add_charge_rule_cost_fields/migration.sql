-- AlterTable
ALTER TABLE "charge_rules" ADD COLUMN     "cost_min_value" DECIMAL(12,2),
ADD COLUMN     "cost_per_kg_charge" DECIMAL(12,2),
ADD COLUMN     "cost_percentage_value" DECIMAL(10,4);
