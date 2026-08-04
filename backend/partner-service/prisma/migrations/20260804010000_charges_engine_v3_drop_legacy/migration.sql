-- DropForeignKey
ALTER TABLE "charge_discount_package_items" DROP CONSTRAINT "charge_discount_package_items_charge_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "charge_discount_package_items" DROP CONSTRAINT "charge_discount_package_items_package_id_fkey";

-- DropForeignKey
ALTER TABLE "charge_discount_packages" DROP CONSTRAINT "charge_discount_packages_partner_id_fkey";

-- DropForeignKey
ALTER TABLE "charge_rules" DROP CONSTRAINT "charge_rules_charges_type_id_fkey";

-- DropForeignKey
ALTER TABLE "charge_rules" DROP CONSTRAINT "charge_rules_partner_id_fkey";

-- DropForeignKey
ALTER TABLE "charge_rules" DROP CONSTRAINT "charge_rules_pincode_type_id_fkey";

-- DropForeignKey
ALTER TABLE "charge_rules" DROP CONSTRAINT "charge_rules_zone_milestone_id_fkey";

-- DropForeignKey
ALTER TABLE "charges_types" DROP CONSTRAINT "charges_types_partner_id_fkey";

-- DropForeignKey
ALTER TABLE "partner_rates" DROP CONSTRAINT "partner_rates_partnerId_fkey";

-- AlterTable
ALTER TABLE "partners" DROP COLUMN "baseRate",
DROP COLUMN "codChargePercent",
DROP COLUMN "fuelSurcharge",
DROP COLUMN "perKgRate";

-- DropTable
DROP TABLE "charge_discount_package_items";

-- DropTable
DROP TABLE "charge_discount_packages";

-- DropTable
DROP TABLE "charge_rules";

-- DropTable
DROP TABLE "charges_types";

-- DropTable
DROP TABLE "partner_rates";

-- DropEnum
DROP TYPE "ChargeRuleBase";

-- DropEnum
DROP TYPE "DiscountType";

