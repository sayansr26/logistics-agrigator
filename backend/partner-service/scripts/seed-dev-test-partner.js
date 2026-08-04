/**
 * Dev fixture — configure the TESTCOURIER partner for Charges Engine v3
 * verification.
 *
 * Creates (idempotently):
 *   - pincode assignments for 400001 (Mumbai), 410210 (Kharghar), 110001 (Delhi)
 *   - a DISTANCE zone with milestones A (0-100km), B (101-500km), C (501-2500km)
 *   - GEOLOGICAL zones West (400001, 410210) and North (110001)
 *   - an ODA pincode type, marked "yes" on 410210
 *   - PartnerChargeConfigs: BASE_FREIGHT, DOCKET_AWB, COD_CHARGE, FUEL_SURCHARGE,
 *     GST, ODA, LOADING_FLOOR, PACKING, HEAVY_HANDLING, ROV_RISK
 *
 * Usage: docker exec logistics-partner-service node scripts/seed-dev-test-partner.js
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const PINCODES = ["400001", "410210", "110001"];

async function ensurePartner() {
  const partner = await prisma.partner.findUnique({
    where: { code: "TESTCOURIER" },
  });
  if (!partner) {
    throw new Error(
      "TESTCOURIER partner not found — create it first via POST /api/v1/partners",
    );
  }
  return partner;
}

async function ensurePincodeAssignments(partnerId) {
  const rows = await prisma.pincode.findMany({
    where: { code: { in: PINCODES } },
    select: { id: true, code: true },
  });
  const byCode = new Map(rows.map((r) => [r.code, r.id]));

  for (const code of PINCODES) {
    const pincodeId = byCode.get(code);
    if (!pincodeId)
      throw new Error(`Pincode ${code} missing from pincodes table`);
    await prisma.partnerPincodeAssign.upsert({
      where: { partnerId_pincodeId: { partnerId, pincodeId } },
      create: { partnerId, pincodeId, isActive: true },
      update: { isActive: true },
    });
  }
  return byCode;
}

async function ensureZones(partnerId, pincodeIdByCode) {
  // DISTANCE zone + milestones
  let distanceZone = await prisma.zone.findFirst({
    where: { partnerId, name: "TestCourier Distance" },
  });
  if (!distanceZone) {
    distanceZone = await prisma.zone.create({
      data: {
        partnerId,
        name: "TestCourier Distance",
        zoneType: "DISTANCE",
        status: true,
      },
    });
  }

  const milestones = [
    { minKm: 0, maxKm: 100, suffix: "A", sortOrder: 1 },
    { minKm: 101, maxKm: 500, suffix: "B", sortOrder: 2 },
    { minKm: 501, maxKm: 2500, suffix: "C", sortOrder: 3 },
  ];
  const milestoneBySuffix = {};
  for (const m of milestones) {
    let row = await prisma.zoneMilestone.findFirst({
      where: { zoneId: distanceZone.id, suffix: m.suffix },
    });
    if (!row) {
      row = await prisma.zoneMilestone.create({
        data: { zoneId: distanceZone.id, ...m },
      });
    }
    milestoneBySuffix[m.suffix] = row;
  }

  // DISTANCE zone must contain the pincodes for coverage checks
  for (const code of PINCODES) {
    const pincodeId = pincodeIdByCode.get(code);
    await prisma.zonePincode.upsert({
      where: {
        zoneId_pincodeId: { zoneId: distanceZone.id, pincodeId },
      },
      create: { zoneId: distanceZone.id, pincodeId },
      update: {},
    });
  }

  // GEOLOGICAL zones
  const geoZones = {};
  for (const [name, codes] of [
    ["TestCourier West", ["400001", "410210"]],
    ["TestCourier North", ["110001"]],
  ]) {
    let zone = await prisma.zone.findFirst({ where: { partnerId, name } });
    if (!zone) {
      zone = await prisma.zone.create({
        data: { partnerId, name, zoneType: "GEOLOGICAL", status: true },
      });
    }
    for (const code of codes) {
      const pincodeId = pincodeIdByCode.get(code);
      await prisma.zonePincode.upsert({
        where: { zoneId_pincodeId: { zoneId: zone.id, pincodeId } },
        create: { zoneId: zone.id, pincodeId },
        update: {},
      });
    }
    geoZones[name] = zone;
  }

  return { distanceZone, milestoneBySuffix, geoZones };
}

async function ensureOdaType(partnerId, pincodeIdByCode) {
  let odaType = await prisma.pincodeType.findUnique({ where: { name: "ODA" } });
  if (!odaType) {
    odaType = await prisma.pincodeType.create({
      data: { name: "ODA", type: "yes_no", isActive: true },
    });
  }

  const assign = await prisma.partnerPincodeAssign.findFirst({
    where: { partnerId, pincodeId: pincodeIdByCode.get("410210") },
  });
  if (assign) {
    await prisma.partnerPincodeTypeValue.upsert({
      where: {
        partnerPincodeId_pincodeTypeId: {
          partnerPincodeId: assign.id,
          pincodeTypeId: odaType.id,
        },
      },
      create: {
        partnerPincodeId: assign.id,
        pincodeTypeId: odaType.id,
        value: "yes",
      },
      update: { value: "yes" },
    });
  }
  return odaType;
}

async function ensureConfigs(partnerId, milestoneBySuffix) {
  const configsByCode = {
    BASE_FREIGHT: {
      mode: "MILESTONE",
      rows: [
        {
          zoneMilestoneId: milestoneBySuffix.A.id,
          perKg: 1,
          charge: 10,
          minCharge: 80,
        },
        {
          zoneMilestoneId: milestoneBySuffix.B.id,
          perKg: 1,
          charge: 14,
          minCharge: 120,
        },
        {
          zoneMilestoneId: milestoneBySuffix.C.id,
          perKg: 1,
          charge: 18,
          minCharge: 180,
        },
      ],
    },
    DOCKET_AWB: { amount: 50 },
    COD_CHARGE: { percent: 2, minAmount: 50 },
    FUEL_SURCHARGE: { percent: 10 },
    GST: { percent: 18 },
    ODA: { perUnit: 6, unitSize: 1, minAmount: 250 },
    LOADING_FLOOR: {
      slabs: [
        { upTo: 0, amount: 150 },
        { upTo: 1, amount: 250 },
        { upTo: 2, amount: 350 },
        { upTo: 99, amount: 500 },
      ],
    },
    PACKING: {
      rates: { WOODEN_BOX: 400, BUBBLE_WRAP: 150, CARTON: 100 },
      perBox: true,
    },
    HEAVY_HANDLING: { amount: 300 },
    ROV_RISK: {
      OWNER: { percent: 0.1, minAmount: 30 },
      CARRIER: { percent: 1.5, minAmount: 100 },
    },
  };

  for (const [code, config] of Object.entries(configsByCode)) {
    const definition = await prisma.chargeDefinition.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!definition) {
      console.warn(
        `Definition ${code} missing — run chargeDefinitions.seed.js first`,
      );
      continue;
    }

    const existing = await prisma.partnerChargeConfig.findFirst({
      where: { partnerId, chargeDefinitionId: definition.id, channelId: null },
    });
    if (existing) {
      await prisma.partnerChargeConfig.update({
        where: { id: existing.id },
        data: { config, isActive: true },
      });
    } else {
      await prisma.partnerChargeConfig.create({
        data: {
          partnerId,
          chargeDefinitionId: definition.id,
          config,
          isActive: true,
        },
      });
    }
  }
}

async function main() {
  const partner = await ensurePartner();
  const pincodeIdByCode = await ensurePincodeAssignments(partner.id);
  const { milestoneBySuffix } = await ensureZones(partner.id, pincodeIdByCode);
  await ensureOdaType(partner.id, pincodeIdByCode);
  await ensureConfigs(partner.id, milestoneBySuffix);

  const configCount = await prisma.partnerChargeConfig.count({
    where: { partnerId: partner.id, isActive: true },
  });
  console.log(
    `TESTCOURIER configured: pincodes ${PINCODES.join(", ")}, ${configCount} active charge configs.`,
  );
}

main()
  .catch((err) => {
    console.error("Dev seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
