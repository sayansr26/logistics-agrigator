/**
 * Charges Engine v3 — Charge Definition Catalog Seed
 *
 * Seeds the dynamic charge catalog. Each definition describes HOW a charge
 * type works (computation method, gating conditions, aggregation, booking
 * question); per-partner values live in PartnerChargeConfig and are created
 * by admins (manually or via the AI config brain).
 *
 * Upserts by `code`, so the seed is safe to re-run. Definition-level
 * `conditions` are defaults; partner configs may override them.
 *
 * Facts registry (must stay in sync with services/chargeEngine/contextBuilder):
 *   paymentType, codAmount, invoiceValue, chargeableWeight, actualWeight,
 *   numberOfBoxes, maxBoxWeightKg, maxDimensionCm, shipmentType, serviceType,
 *   shipmentDirection, isFragile, distanceKm, outletBadge,
 *   pickup.city|state|isMetro|cityClass, delivery.city|state|isMetro|cityClass,
 *   side.pincodeType.<NAME>            (per-side evaluation when aggregation.perSide),
 *   answers.<questionKey>[...path]     (booking-form answers)
 *
 * Usage:
 *   docker exec logistics-partner-service node prisma/seeds/chargeDefinitions.seed.js
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const D = (def) => ({
  description: null,
  bookingQuestion: null,
  conditions: null,
  aggregation: null,
  flags: { taxable: true },
  isSystem: false,
  isActive: true,
  ...def,
});

const DEFINITIONS = [
  // ==================== PHASE 100 — BASE FREIGHT ====================
  D({
    code: "BASE_FREIGHT",
    name: "Base Freight",
    category: "BASE",
    applyStage: "QUOTE",
    phase: 100,
    description:
      "Core freight charge. MATRIX config: mode MILESTONE (distance slabs via zoneMilestoneId rows) or ZONE_PAIR (fromZoneId/toZoneId rows). Each row: perKg (slab size, kg), charge (per slab), minCharge.",
    computation: {
      method: "MATRIX",
      basis: "CHARGEABLE_WEIGHT",
      paramsSchema: {
        mode: "MILESTONE|ZONE_PAIR",
        rows: [
          {
            zoneMilestoneId: "uuid?",
            fromZoneId: "uuid?",
            toZoneId: "uuid?",
            perKg: "number",
            charge: "number",
            minCharge: "number?",
          },
        ],
      },
    },
    aggregation: { group: "BASE", strategy: "HIGHEST" },
    flags: { taxable: true, fuelApplicable: true },
    isSystem: true,
  }),

  // ==================== PHASE 200 — DOCKET / WEIGHT ADD-ONS ====================
  D({
    code: "DOCKET_AWB",
    name: "Docket/AWB Processing Charge",
    category: "BASE",
    applyStage: "QUOTE",
    phase: 200,
    description: "Flat per-shipment docket/AWB processing fee.",
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
  }),

  // ==================== PHASE 300 — PICKUP / DELIVERY ====================
  D({
    code: "ODA",
    name: "ODA Charge",
    category: "PICKUP_DELIVERY",
    applyStage: "QUOTE",
    phase: 300,
    description:
      "Out-of-Delivery-Area surcharge, auto-detected per side from the partner's pincode-type values. Charged per unitSize kg with a minimum.",
    computation: {
      method: "PER_UNIT",
      basis: "CHARGEABLE_WEIGHT",
      paramsSchema: {
        perUnit: "number",
        unitSize: "number",
        minAmount: "number",
      },
    },
    conditions: {
      all: [{ fact: "side.pincodeType.ODA", op: "eq", value: "yes" }],
    },
    aggregation: { group: "ODA", strategy: "SUM", perSide: true },
    flags: { taxable: true, fuelApplicable: true },
  }),
  D({
    code: "DOOR_PICKUP",
    name: "Pickup Charge",
    category: "PICKUP_DELIVERY",
    applyStage: "BOOKING_OPTION",
    phase: 300,
    description: "Door pickup service charge (vs self-drop at hub).",
    bookingQuestion: {
      key: "pickupMode",
      label: "How will the shipment reach us?",
      type: "select",
      options: [
        { value: "SELF_DROP", label: "I will self-drop at the hub" },
        { value: "DOOR_PICKUP", label: "Pickup from my door" },
      ],
      default: "DOOR_PICKUP",
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: {
      all: [{ fact: "answers.pickupMode", op: "eq", value: "DOOR_PICKUP" }],
    },
    flags: { taxable: true, fuelApplicable: true },
  }),
  D({
    code: "DOOR_DELIVERY",
    name: "Door Delivery Charge",
    category: "PICKUP_DELIVERY",
    applyStage: "BOOKING_OPTION",
    phase: 300,
    description: "Door delivery service charge (vs collection from hub).",
    bookingQuestion: {
      key: "deliveryMode",
      label: "How should the shipment be delivered?",
      type: "select",
      options: [
        { value: "HUB_COLLECT", label: "Receiver collects from hub" },
        { value: "DOOR_DELIVERY", label: "Deliver to receiver's door" },
      ],
      default: "DOOR_DELIVERY",
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: {
      all: [{ fact: "answers.deliveryMode", op: "eq", value: "DOOR_DELIVERY" }],
    },
    flags: { taxable: true, fuelApplicable: true },
  }),
  D({
    code: "APPOINTMENT_PICKUP",
    name: "Special Pickup Charge",
    category: "PICKUP_DELIVERY",
    applyStage: "BOOKING_OPTION",
    phase: 300,
    description: "Scheduled/appointment pickup at a specific date-time.",
    bookingQuestion: {
      key: "appointmentPickup",
      label: "Do you need a scheduled pickup slot?",
      type: "boolean",
      followUp: [
        {
          when: true,
          key: "datetime",
          label: "Pickup appointment date & time",
          type: "datetime",
        },
      ],
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: {
      all: [
        { fact: "answers.appointmentPickup.enabled", op: "eq", value: true },
      ],
    },
  }),
  D({
    code: "APPOINTMENT_DELIVERY",
    name: "Special Drop Charge",
    category: "PICKUP_DELIVERY",
    applyStage: "BOOKING_OPTION",
    phase: 300,
    description: "Scheduled/appointment delivery at a specific date-time.",
    bookingQuestion: {
      key: "appointmentDelivery",
      label: "Do you need a scheduled delivery slot?",
      type: "boolean",
      followUp: [
        {
          when: true,
          key: "datetime",
          label: "Delivery appointment date & time",
          type: "datetime",
        },
      ],
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: {
      all: [
        { fact: "answers.appointmentDelivery.enabled", op: "eq", value: true },
      ],
    },
  }),
  D({
    code: "HOLIDAY_PICKUP",
    name: "Holiday Pickup Charge",
    category: "PICKUP_DELIVERY",
    applyStage: "BOOKING_OPTION",
    phase: 300,
    description: "Sunday/holiday pickup surcharge.",
    bookingQuestion: {
      key: "holidayPickup",
      label: "Pickup on Sunday/holiday?",
      type: "boolean",
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: {
      all: [{ fact: "answers.holidayPickup", op: "eq", value: true }],
    },
  }),
  D({
    code: "HOLIDAY_DELIVERY",
    name: "Holiday Delivery Charge",
    category: "PICKUP_DELIVERY",
    applyStage: "BOOKING_OPTION",
    phase: 300,
    description: "Sunday/holiday delivery surcharge.",
    bookingQuestion: {
      key: "holidayDelivery",
      label: "Delivery on Sunday/holiday?",
      type: "boolean",
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: {
      all: [{ fact: "answers.holidayDelivery", op: "eq", value: true }],
    },
  }),

  // ==================== PHASE 400 — VAS / SURCHARGES ====================
  D({
    code: "HEAVY_HANDLING",
    name: "Handling Charge",
    category: "VAS",
    applyStage: "BOOKING_OPTION",
    phase: 400,
    description: "Heavy/special shipment handling (single box over 30kg).",
    bookingQuestion: {
      key: "heavyHandling",
      label: "Any single box over 30kg (heavy/special handling)?",
      type: "boolean",
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: {
      all: [{ fact: "answers.heavyHandling", op: "eq", value: true }],
    },
  }),
  D({
    code: "LOADING_FLOOR",
    name: "Loading Charge",
    category: "VAS",
    applyStage: "BOOKING_OPTION",
    phase: 400,
    description: "Loading manpower charge, slabbed by floor number at pickup.",
    bookingQuestion: {
      key: "loading",
      label: "Need loading manpower at pickup?",
      type: "boolean",
      followUp: [
        {
          when: true,
          key: "floor",
          label: "Which floor?",
          type: "select",
          options: [
            { value: 0, label: "Ground floor" },
            { value: 1, label: "1st floor" },
            { value: 2, label: "2nd floor" },
            { value: 3, label: "3rd floor or above" },
          ],
        },
      ],
    },
    computation: {
      method: "SLAB",
      basis: "ANSWER_VALUE",
      answerPath: "loading.floor",
      paramsSchema: { slabs: [{ upTo: "number", amount: "number" }] },
    },
    conditions: {
      all: [{ fact: "answers.loading.enabled", op: "eq", value: true }],
    },
  }),
  D({
    code: "UNLOADING_FLOOR",
    name: "Unloading Charge",
    category: "VAS",
    applyStage: "BOOKING_OPTION",
    phase: 400,
    description:
      "Unloading manpower charge, slabbed by floor number at delivery.",
    bookingQuestion: {
      key: "unloading",
      label: "Need unloading manpower at delivery?",
      type: "boolean",
      followUp: [
        {
          when: true,
          key: "floor",
          label: "Which floor?",
          type: "select",
          options: [
            { value: 0, label: "Ground floor" },
            { value: 1, label: "1st floor" },
            { value: 2, label: "2nd floor" },
            { value: 3, label: "3rd floor or above" },
          ],
        },
      ],
    },
    computation: {
      method: "SLAB",
      basis: "ANSWER_VALUE",
      answerPath: "unloading.floor",
      paramsSchema: { slabs: [{ upTo: "number", amount: "number" }] },
    },
    conditions: {
      all: [{ fact: "answers.unloading.enabled", op: "eq", value: true }],
    },
  }),
  D({
    code: "PACKING",
    name: "Packing Charge",
    category: "VAS",
    applyStage: "BOOKING_OPTION",
    phase: 400,
    description:
      "Hub packing service by material. OPTION_RATE config: rates per selected option; perBox multiplies by numberOfBoxes.",
    bookingQuestion: {
      key: "packingMaterial",
      label: "Packing service",
      type: "select",
      options: [
        { value: "SELF", label: "Self packing (no charge)" },
        { value: "WOODEN_BOX", label: "Wooden box packing" },
        { value: "BUBBLE_WRAP", label: "Bubble wrap packing" },
        { value: "CARTON", label: "Carton packing" },
      ],
      default: "SELF",
    },
    computation: {
      method: "OPTION_RATE",
      basis: "ANSWER_VALUE",
      answerPath: "packingMaterial",
      paramsSchema: {
        rates: { "<optionValue>": "number" },
        perBox: "boolean?",
      },
    },
    conditions: {
      all: [{ fact: "answers.packingMaterial", op: "ne", value: "SELF" }],
    },
  }),
  D({
    code: "POD_PHYSICAL",
    name: "POD Charge",
    category: "VAS",
    applyStage: "BOOKING_OPTION",
    phase: 400,
    description: "Physical proof-of-delivery courier-back charge.",
    bookingQuestion: {
      key: "physicalPod",
      label: "Need physical POD couriered back?",
      type: "boolean",
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: {
      all: [{ fact: "answers.physicalPod", op: "eq", value: true }],
    },
  }),
  D({
    code: "FRAGILE",
    name: "Fragile Item Charge",
    category: "SURCHARGE",
    applyStage: "QUOTE",
    phase: 400,
    description:
      "Extra care for fragile items; min-or-percentage of invoice value.",
    computation: {
      method: "PERCENT_WITH_MIN",
      basis: "INVOICE_VALUE",
      paramsSchema: { percent: "number", minAmount: "number" },
    },
    conditions: { all: [{ fact: "isFragile", op: "eq", value: true }] },
  }),
  D({
    code: "OVERSIZE",
    name: "Oversize Shipment Charge",
    category: "SURCHARGE",
    applyStage: "QUOTE",
    phase: 400,
    description:
      "Large-dimension surcharge. Default threshold 120cm on the longest side; override per partner via config conditions.",
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: { all: [{ fact: "maxDimensionCm", op: "gt", value: 120 }] },
  }),
  D({
    code: "TDD",
    name: "TDD Charge",
    category: "VAS",
    applyStage: "BOOKING_OPTION",
    phase: 400,
    description: "Time-definite delivery surcharge.",
    bookingQuestion: {
      key: "tdd",
      label: "Time-definite delivery required?",
      type: "boolean",
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: { all: [{ fact: "answers.tdd", op: "eq", value: true }] },
  }),
  D({
    code: "CRITICAL_SHIPMENT",
    name: "Critical Shipment Charge",
    category: "VAS",
    applyStage: "BOOKING_OPTION",
    phase: 400,
    description: "Urgent/critical shipment handling surcharge.",
    bookingQuestion: {
      key: "critical",
      label: "Mark as critical/urgent shipment?",
      type: "boolean",
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: { all: [{ fact: "answers.critical", op: "eq", value: true }] },
  }),
  D({
    code: "TEMP_CONTROLLED",
    name: "Temperature-Controlled Charge",
    category: "VAS",
    applyStage: "BOOKING_OPTION",
    phase: 400,
    description:
      "Cold-chain transportation, charged per unitSize kg with a minimum.",
    bookingQuestion: {
      key: "tempControlled",
      label: "Temperature-controlled (cold chain) transport?",
      type: "boolean",
    },
    computation: {
      method: "PER_UNIT",
      basis: "CHARGEABLE_WEIGHT",
      paramsSchema: {
        perUnit: "number",
        unitSize: "number",
        minAmount: "number",
      },
    },
    conditions: {
      all: [{ fact: "answers.tempControlled", op: "eq", value: true }],
    },
  }),
  D({
    code: "CARRIER_LABEL",
    name: "Carrier Partner Label Charge",
    category: "VAS",
    applyStage: "QUOTE",
    phase: 400,
    description: "Carrier label/printing charge, flat per shipment.",
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
  }),
  D({
    code: "SMS_NOTIFICATION",
    name: "SMS Charges",
    category: "NOTIFICATION",
    applyStage: "BOOKING_OPTION",
    phase: 400,
    description: "SMS notification charge, flat per shipment.",
    bookingQuestion: {
      key: "smsNotify",
      label: "SMS notifications?",
      type: "boolean",
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: { all: [{ fact: "answers.smsNotify", op: "eq", value: true }] },
  }),
  D({
    code: "WHATSAPP_NOTIFICATION",
    name: "WhatsApp Notification Charges",
    category: "NOTIFICATION",
    applyStage: "BOOKING_OPTION",
    phase: 400,
    description: "WhatsApp notification charge, flat per shipment.",
    bookingQuestion: {
      key: "whatsappNotify",
      label: "WhatsApp notifications?",
      type: "boolean",
    },
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: {
      all: [{ fact: "answers.whatsappNotify", op: "eq", value: true }],
    },
  }),

  // ==================== PHASE 500 — VALUE-BASED (COD / RISK) ====================
  D({
    code: "COD_CHARGE",
    name: "COD Charge",
    category: "COD",
    applyStage: "QUOTE",
    phase: 500,
    description:
      "Cash-on-delivery charge: max(minAmount, percent% of COD amount).",
    computation: {
      method: "PERCENT_WITH_MIN",
      basis: "COD_AMOUNT",
      paramsSchema: { percent: "number", minAmount: "number" },
    },
    conditions: {
      all: [
        { fact: "paymentType", op: "eq", value: "COD" },
        { fact: "codAmount", op: "gt", value: 0 },
      ],
    },
    aggregation: { group: "COD", strategy: "HIGHEST" },
  }),
  D({
    code: "EARLY_COD",
    name: "Early COD Charge",
    category: "COD",
    applyStage: "BOOKING_OPTION",
    phase: 500,
    description:
      "Early COD settlement: max(minAmount, percent% of COD amount).",
    bookingQuestion: {
      key: "earlyCod",
      label: "Early COD settlement?",
      type: "boolean",
    },
    computation: {
      method: "PERCENT_WITH_MIN",
      basis: "COD_AMOUNT",
      paramsSchema: { percent: "number", minAmount: "number" },
    },
    conditions: {
      all: [
        { fact: "paymentType", op: "eq", value: "COD" },
        { fact: "answers.earlyCod", op: "eq", value: true },
      ],
    },
  }),
  D({
    code: "COD_VERIFICATION",
    name: "COD Delivery Verification",
    category: "COD",
    applyStage: "QUOTE",
    phase: 500,
    description:
      "AI-predicted COD delivery-risk verification fee. When the AI risk band is unavailable, the flat configured amount applies (or zero if unconfigured).",
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: { all: [{ fact: "paymentType", op: "eq", value: "COD" }] },
    flags: { taxable: true, aiAssisted: true },
  }),
  D({
    code: "ROV_RISK",
    name: "ROV Charge",
    category: "RISK",
    applyStage: "BOOKING_OPTION",
    phase: 500,
    description:
      "Risk-of-value (insurance) charge by risk type. optionsBy: config holds {OWNER: {percent, minAmount}, CARRIER: {...}} of invoice value.",
    bookingQuestion: {
      key: "riskType",
      label: "Insure your shipment",
      type: "select",
      options: [
        { value: "OWNER", label: "Ship at Owner's Risk" },
        { value: "CARRIER", label: "Carrier's Risk (insured)" },
      ],
      default: "OWNER",
    },
    computation: {
      method: "PERCENT_WITH_MIN",
      basis: "INVOICE_VALUE",
      optionsBy: "riskType",
      paramsSchema: {
        "<optionValue>": { percent: "number", minAmount: "number" },
      },
    },
    conditions: { all: [{ fact: "answers.riskType", op: "exists" }] },
  }),

  // ==================== PHASE 600-700 — ADJUSTMENTS ====================
  D({
    code: "FUEL_SURCHARGE",
    name: "Fuel Surcharge",
    category: "SURCHARGE",
    applyStage: "QUOTE",
    phase: 600,
    description:
      "Fuel price adjustment: percent over the sum of fuel-applicable lines (base + pickup + delivery).",
    computation: {
      method: "RATE_ADJUSTMENT",
      basis: "SUBTOTAL",
      subtotalOf: "FUEL_APPLICABLE",
      paramsSchema: { percent: "number" },
    },
    isSystem: true,
  }),
  D({
    code: "GREEN_TAX",
    name: "Green Tax",
    category: "TAX",
    applyStage: "QUOTE",
    phase: 650,
    description:
      "City/state entry green tax. Gate by destination via config conditions (e.g. delivery.state in [...] or delivery.city in [...]).",
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
    conditions: { all: [{ fact: "delivery.state", op: "in", value: [] }] },
    flags: { taxable: false },
  }),
  D({
    code: "RTO_REVERSE",
    name: "Reverse/RTO Pickup Charge",
    category: "SURCHARGE",
    applyStage: "QUOTE",
    phase: 700,
    description:
      "Reverse-shipment pricing: percent of the freight subtotal plus optional flat extra. Applies when shipmentDirection is REVERSE.",
    computation: {
      method: "RATE_ADJUSTMENT",
      basis: "SUBTOTAL",
      subtotalOf: "FREIGHT",
      paramsSchema: { percent: "number", flatExtra: "number?" },
    },
    conditions: {
      all: [{ fact: "shipmentDirection", op: "eq", value: "REVERSE" }],
    },
  }),

  // ==================== PHASE 800 — DISCOUNT ====================
  D({
    code: "BADGE_DISCOUNT",
    name: "Outlet Badge Discount",
    category: "DISCOUNT",
    applyStage: "QUOTE",
    phase: 800,
    description:
      "Badge-tier discount on the pre-tax subtotal. Config: {tiers: {GOLD: {type: FLAT|PERCENTAGE, value}, ...}}. Emits a negative line.",
    computation: {
      method: "DISCOUNT",
      basis: "SUBTOTAL",
      subtotalOf: "PRE_TAX",
      paramsSchema: {
        tiers: { "<badge>": { type: "FLAT|PERCENTAGE", value: "number" } },
      },
    },
    conditions: { all: [{ fact: "outletBadge", op: "exists" }] },
    flags: { taxable: false },
    isSystem: true,
  }),

  // ==================== PHASE 900 — GST ====================
  D({
    code: "GST",
    name: "GST",
    category: "TAX",
    applyStage: "QUOTE",
    phase: 900,
    description: "GST over the taxable subtotal (default 18%).",
    computation: {
      method: "RATE_ADJUSTMENT",
      basis: "SUBTOTAL",
      subtotalOf: "TAXABLE",
      paramsSchema: { percent: "number" },
    },
    flags: { taxable: false },
    isSystem: true,
  }),

  // ==================== EVENT-STAGE (post-booking adjustments) ====================
  D({
    code: "ADDRESS_CORRECTION",
    name: "Address Correction Charge",
    category: "EVENT",
    applyStage: "EVENT",
    phase: 950,
    description: "Pincode/address/mobile-number correction after booking.",
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
  }),
  D({
    code: "REATTEMPT_DELIVERY",
    name: "Reattempt Delivery Charge",
    category: "EVENT",
    applyStage: "EVENT",
    phase: 950,
    description:
      "Delivery attempts beyond freeAttempts (default 2): amount per extra attempt. eventParams: {attempts}.",
    computation: {
      method: "PER_UNIT_TIME",
      basis: "EVENT_UNITS",
      paramsSchema: {
        perUnit: "number",
        freeUnits: "number",
        minAmount: "number?",
      },
    },
  }),
  D({
    code: "DEMURRAGE",
    name: "Demurrage Charge",
    category: "EVENT",
    applyStage: "EVENT",
    phase: 950,
    description:
      "Storage/delay charge per kg per day after freeUnits days (default 5). eventParams: {days}.",
    computation: {
      method: "PER_UNIT_TIME",
      basis: "CHARGEABLE_WEIGHT",
      paramsSchema: {
        perKgPerDay: "number",
        freeUnits: "number",
        minAmount: "number?",
      },
    },
  }),
  D({
    code: "CANCELLATION_IN_TRANSIT",
    name: "Cancellation Charge",
    category: "EVENT",
    applyStage: "EVENT",
    phase: 950,
    description: "Shipment cancellation fee while in transit.",
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
  }),
  D({
    code: "NDR_MANAGEMENT",
    name: "NDR Management Charge",
    category: "EVENT",
    applyStage: "EVENT",
    phase: 950,
    description: "Non-delivery report handling charge.",
    computation: {
      method: "FLAT",
      basis: "NONE",
      paramsSchema: { amount: "number" },
    },
  }),
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const def of DEFINITIONS) {
    const existing = await prisma.chargeDefinition.findUnique({
      where: { code: def.code },
      select: { id: true },
    });

    await prisma.chargeDefinition.upsert({
      where: { code: def.code },
      create: def,
      update: def,
    });

    if (existing) updated += 1;
    else created += 1;
  }

  console.log(
    `Charge definition catalog seeded: ${created} created, ${updated} updated, ${DEFINITIONS.length} total.`,
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
