/**
 * Legacy Charges Export (one-time, read-only)
 *
 * Exports the Gen1/Gen2 charge configuration (charge_rules, charges_types,
 * charge_discount_packages + items, partner_rates, Partner legacy pricing
 * columns) to a timestamped JSON file BEFORE the destructive charges-engine-v3
 * migration drops those tables.
 *
 * The output file is the input for the AI-assisted re-import endpoint
 * (POST /api/v1/charge-configs/ai/import-legacy), which proposes equivalent
 * v3 ChargeDefinition/PartnerChargeConfig drafts for admin review.
 *
 * Usage (inside the container so DATABASE_URL resolves):
 *   docker exec logistics-partner-service node scripts/export-legacy-charges.js
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const [
    chargeRules,
    chargesTypes,
    discountPackages,
    partnerRates,
    partners,
    pincodeTypes,
    zones,
    zoneMilestones,
  ] = await Promise.all([
    prisma.chargeRule.findMany({
      include: {
        partner: { select: { id: true, name: true, code: true } },
        chargesType: { select: { id: true, name: true } },
        pincodeType: { select: { id: true, name: true, type: true } },
        zoneMilestone: {
          select: {
            id: true,
            minKm: true,
            maxKm: true,
            suffix: true,
            zoneId: true,
          },
        },
      },
    }),
    prisma.chargesType.findMany({
      include: { partner: { select: { id: true, name: true, code: true } } },
    }),
    prisma.chargeDiscountPackage.findMany({
      include: {
        partner: { select: { id: true, name: true, code: true } },
        items: { include: { chargeRule: true } },
      },
    }),
    prisma.partnerRate.findMany(),
    prisma.partner.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        baseRate: true,
        perKgRate: true,
        codChargePercent: true,
        fuelSurcharge: true,
      },
    }),
    // Reference data so the importer can resolve names without a live DB of
    // the old shape
    prisma.pincodeType.findMany(),
    prisma.zone.findMany({
      select: { id: true, partnerId: true, name: true, zoneType: true },
    }),
    prisma.zoneMilestone.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaGeneration: "G2 (charge_rules) + G1 remnants (partner_rates)",
    counts: {
      chargeRules: chargeRules.length,
      chargesTypes: chargesTypes.length,
      discountPackages: discountPackages.length,
      partnerRates: partnerRates.length,
      partnersWithLegacyPricing: partners.filter(
        (p) =>
          p.baseRate !== null ||
          p.perKgRate !== null ||
          p.codChargePercent !== null ||
          p.fuelSurcharge !== null,
      ).length,
    },
    chargeRules,
    chargesTypes,
    discountPackages,
    partnerRates,
    partnerLegacyPricing: partners,
    reference: { pincodeTypes, zones, zoneMilestones },
  };

  const backupsDir = path.join(__dirname, "..", "prisma", "backups");
  fs.mkdirSync(backupsDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(backupsDir, `legacy-charges-export-${stamp}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      payload,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );

  console.log(`Exported legacy charges to ${outFile}`);
  console.log(JSON.stringify(payload.counts, null, 2));
}

main()
  .catch((err) => {
    console.error("Export failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
