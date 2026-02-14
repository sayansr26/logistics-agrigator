-- CreateEnum: ChargeRuleKind
CREATE TYPE "ChargeRuleKind" AS ENUM ('PARTNER_CHARGES_TYPE', 'GEOLOGICAL', 'ADDON');

-- CreateEnum: ChargeRuleBase
CREATE TYPE "ChargeRuleBase" AS ENUM ('INVOICE_VALUE', 'WEIGHT', 'ZONE_TO_ZONE_WEIGHT', 'DISTANCE_BASE_WEIGHT');

-- CreateEnum: ChargeCalcType
CREATE TYPE "ChargeCalcType" AS ENUM ('FLAT', 'PERCENTAGE');

-- CreateTable: charge_rules
CREATE TABLE "charge_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" TEXT NOT NULL,
    "kind" "ChargeRuleKind" NOT NULL,
    "base" "ChargeRuleBase" NOT NULL,
    "charges_type_id" UUID,
    "pincode_type_id" UUID,
    "from_amount" DECIMAL(12,2),
    "to_amount" DECIMAL(12,2),
    "charge" DECIMAL(12,2),
    "calc_type" "ChargeCalcType",
    "min_kg" DECIMAL(10,3),
    "max_kg" DECIMAL(10,3),
    "from_zone_id" UUID,
    "to_zone_id" UUID,
    "min_weight_kg" DECIMAL(10,3),
    "addon_weight_kg" DECIMAL(10,3),
    "weight_charge" DECIMAL(12,2),
    "addon_charge" DECIMAL(12,2),
    "division" VARCHAR(50),
    "from_km" INTEGER,
    "to_km" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "charge_rules_partner_id_kind_base_is_active_idx" ON "charge_rules"("partner_id", "kind", "base", "is_active");

-- CreateIndex
CREATE INDEX "charge_rules_partner_id_charges_type_id_base_is_active_idx" ON "charge_rules"("partner_id", "charges_type_id", "base", "is_active");

-- CreateIndex
CREATE INDEX "charge_rules_partner_id_pincode_type_id_is_active_idx" ON "charge_rules"("partner_id", "pincode_type_id", "is_active");

-- AddForeignKey: partner
ALTER TABLE "charge_rules" ADD CONSTRAINT "charge_rules_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: charges_type
ALTER TABLE "charge_rules" ADD CONSTRAINT "charge_rules_charges_type_id_fkey" FOREIGN KEY ("charges_type_id") REFERENCES "charges_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: pincode_type
ALTER TABLE "charge_rules" ADD CONSTRAINT "charge_rules_pincode_type_id_fkey" FOREIGN KEY ("pincode_type_id") REFERENCES "pincode_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropTable: charge_packages (legacy - hard replace)
DROP TABLE IF EXISTS "charge_packages";

-- DropEnum: ChargePackageAppliesTo (legacy)
DROP TYPE IF EXISTS "ChargePackageAppliesTo";

-- DropEnum: ChargePackageCalcType (legacy)
DROP TYPE IF EXISTS "ChargePackageCalcType";

-- DropEnum: ChargePackageType (legacy)
DROP TYPE IF EXISTS "ChargePackageType";
