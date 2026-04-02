/**
 * Charges Rule Calculation Service (redesigned)
 *
 * Formulas:
 * - INVOICE_VALUE:
 *     computed = (percentageValue / 100) * invoiceValue
 *     final    = max(minValue, computed)
 * - WEIGHT / ZONE_TO_ZONE_WEIGHT / DISTANCE_BASE_WEIGHT:
 *     computed = ceil(effectiveWeight / perKg) * perKgCharge
 *     final    = max(minValue, computed)
 *
 * Pincode-type rules (pincodeTypeId set):
 *   Apply per-side (pickup AND delivery).
 *   A side is "active" when the partner-pincode assignment has that pincodeTypeId
 *   with value = "yes" (yes_no type) or value > 0 (number type).
 *   Sum pickup + delivery contributions.
 *
 * Category grouping:
 *   - chargesType rules: group by chargesTypeId + base → pick highest across rules
 *   - pincodeType rules: group by pincodeTypeId + base → evaluate per-side and SUM sides
 *   - zone-to-zone / distance: no type FK → one rule per combination
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { matchesSemantic } = require("../utils/typeNameNormalizer");

// ========================================
// INDIVIDUAL CHARGE CALCULATORS
// ========================================

/**
 * Compute charge for INVOICE_VALUE base
 * @param {Object} rule
 * @param {number} invoiceValue
 * @returns {{ totalCharge: number, calculation: string } | null}
 */
function calcInvoiceValue(rule, invoiceValue) {
  const minValue = parseFloat(rule.minValue) || 0;
  const pct = parseFloat(rule.percentageValue) || 0;

  const computed = (pct / 100) * invoiceValue;
  const finalCharge = Math.max(minValue, computed);

  return {
    ruleId: rule.id,
    base: "INVOICE_VALUE",
    minValue,
    percentageValue: pct,
    computed: Math.round(computed * 100) / 100,
    totalCharge: Math.round(finalCharge * 100) / 100,
    calculation: `max(${minValue}, ${pct}% of ₹${invoiceValue}) = ₹${Math.round(finalCharge * 100) / 100}`,
  };
}

/**
 * Compute charge for WEIGHT base
 * @param {Object} rule
 * @param {number} weightKg
 * @returns {{ totalCharge: number, calculation: string } | null}
 */
function calcWeight(rule, weightKg) {
  const minValue = parseFloat(rule.minValue) || 0;
  const perKg = parseFloat(rule.perKg) || 1;
  const perKgCharge = parseFloat(rule.perKgCharge) || 0;

  const computed = Math.ceil(weightKg / perKg) * perKgCharge;
  const finalCharge = Math.max(minValue, computed);

  return {
    ruleId: rule.id,
    base: "WEIGHT",
    minValue,
    perKg,
    perKgCharge,
    computed: Math.round(computed * 100) / 100,
    totalCharge: Math.round(finalCharge * 100) / 100,
    calculation: `max(${minValue}, ceil(${weightKg}/${perKg}) × ₹${perKgCharge}) = ₹${Math.round(finalCharge * 100) / 100}`,
  };
}

/**
 * Compute charge for ZONE_TO_ZONE_WEIGHT base
 * @param {Object} rule
 * @param {number} weightKg
 * @param {string[]} pickupZoneIds
 * @param {string[]} deliveryZoneIds
 * @returns {{ totalCharge: number, calculation: string } | null}
 */
function calcZoneToZoneWeight(rule, weightKg, pickupZoneIds, deliveryZoneIds) {
  if (
    !pickupZoneIds.includes(rule.fromZoneId) ||
    !deliveryZoneIds.includes(rule.toZoneId)
  ) {
    return null;
  }

  const minValue = parseFloat(rule.minValue) || 0;
  const perKg = parseFloat(rule.perKg) || 1;
  const perKgCharge = parseFloat(rule.perKgCharge) || 0;

  const computed = Math.ceil(weightKg / perKg) * perKgCharge;
  const finalCharge = Math.max(minValue, computed);

  return {
    ruleId: rule.id,
    base: "ZONE_TO_ZONE_WEIGHT",
    fromZoneId: rule.fromZoneId,
    toZoneId: rule.toZoneId,
    minValue,
    perKg,
    perKgCharge,
    computed: Math.round(computed * 100) / 100,
    totalCharge: Math.round(finalCharge * 100) / 100,
    calculation: `max(${minValue}, ceil(${weightKg}/${perKg}) × ₹${perKgCharge}) = ₹${Math.round(finalCharge * 100) / 100}`,
  };
}

/**
 * Compute charge for DISTANCE_BASE_WEIGHT base
 * Matches by zoneMilestoneId against context.distanceMilestoneId.
 * @param {Object} rule
 * @param {number} weightKg
 * @param {string|null} distanceMilestoneId
 * @returns {{ totalCharge: number, calculation: string } | null}
 */
function calcDistanceBaseWeight(rule, weightKg, distanceMilestoneId) {
  if (!rule.zoneMilestoneId || rule.zoneMilestoneId !== distanceMilestoneId) {
    return null;
  }

  const minValue = parseFloat(rule.minValue) || 0;
  const perKg = parseFloat(rule.perKg) || 1;
  const perKgCharge = parseFloat(rule.perKgCharge) || 0;

  const computed = Math.ceil(weightKg / perKg) * perKgCharge;
  const finalCharge = Math.max(minValue, computed);

  return {
    ruleId: rule.id,
    base: "DISTANCE_BASE_WEIGHT",
    zoneMilestoneId: rule.zoneMilestoneId,
    milestoneLabel: rule.zoneMilestone
      ? `${rule.zoneMilestone.minKm}-${rule.zoneMilestone.maxKm}km`
      : null,
    minValue,
    perKg,
    perKgCharge,
    computed: Math.round(computed * 100) / 100,
    totalCharge: Math.round(finalCharge * 100) / 100,
    calculation: `max(${minValue}, ceil(${weightKg}/${perKg}) × ₹${perKgCharge}) = ₹${Math.round(finalCharge * 100) / 100}`,
  };
}

// ========================================
// PINCODE TYPE APPLICABILITY
// ========================================

/**
 * Check if a pincode-type rule is active for a given side's type values.
 * Tolerant of various yes/no representations (yes, Yes, YES, true, 1, y).
 * @param {string} pincodeTypeId
 * @param {string} pincodeTypeDataType - "yes_no" | "number"
 * @param {Object} sideTypeValues - map of pincodeTypeId → value string
 * @returns {boolean}
 */
function isPincodeTypeActive(
  pincodeTypeId,
  pincodeTypeDataType,
  sideTypeValues,
) {
  if (!sideTypeValues || !pincodeTypeId) return false;
  const val = sideTypeValues[pincodeTypeId];
  if (val === undefined || val === null) return false;

  if (pincodeTypeDataType === "yes_no") {
    const normalised = val.toString().trim().toLowerCase();
    return ["yes", "y", "true", "1"].includes(normalised);
  }
  if (pincodeTypeDataType === "number") {
    return parseFloat(val) > 0;
  }
  return false;
}

// ========================================
// MAIN CALCULATION ENGINE
// ========================================

/**
 * Determine whether a charge rule should be included based on the shipment context.
 *
 * Conditional gating:
 * - FRAGILE charges → only when isFragile === true
 * - COD charges     → only when paymentType === "COD"
 * - PREPAID charges → only when paymentType === "PREPAID"
 * - REVERSE charges → only when paymentType === "REVERSE"
 * - All others (weight, distance, insurance, etc.) → always included
 *
 * Works on both chargesType.name and pincodeType.name using canonical normalization.
 */
function shouldIncludeRule(rule, context) {
  const { isFragile, paymentType } = context;

  const ctName = rule.chargesType?.name;
  const ptName = rule.pincodeType?.name;

  // Fragile gating (chargesType or pincodeType named "fragile"/"FRGILE"/etc.)
  if (
    matchesSemantic(ctName, "FRAGILE") ||
    matchesSemantic(ptName, "FRAGILE")
  ) {
    return !!isFragile;
  }

  // COD gating
  if (matchesSemantic(ctName, "COD") || matchesSemantic(ptName, "COD")) {
    return (paymentType || "").toUpperCase() === "COD";
  }

  // Prepaid gating
  if (
    matchesSemantic(ctName, "PREPAID") ||
    matchesSemantic(ptName, "PREPAID")
  ) {
    return (paymentType || "").toUpperCase() === "PREPAID";
  }

  // Reverse gating
  if (
    matchesSemantic(ctName, "REVERSE") ||
    matchesSemantic(ptName, "REVERSE")
  ) {
    return (paymentType || "").toUpperCase() === "REVERSE";
  }

  return true;
}

/**
 * Calculate all charges for a partner given shipment context.
 *
 * @param {string} partnerId
 * @param {Object} context
 * @param {number} context.effectiveWeight - kg
 * @param {number} context.invoiceValue - declared value
 * @param {boolean} [context.isFragile=false]
 * @param {string} [context.paymentType='PREPAID']
 * @param {string|null} context.distanceMilestoneId - ZoneMilestone.id matched by distance zone
 * @param {string[]} context.pickupGeoZoneIds - GEOLOGICAL zone IDs covering pickup
 * @param {string[]} context.deliveryGeoZoneIds - GEOLOGICAL zone IDs covering delivery
 * @param {Object} context.pickupPincodeTypeValues - { [pincodeTypeId]: valueString }
 * @param {Object} context.deliveryPincodeTypeValues - { [pincodeTypeId]: valueString }
 * @returns {Promise<{ totalCharge, breakdown[] }>}
 */
async function calculateCharges(partnerId, context) {
  const {
    effectiveWeight = 0,
    invoiceValue = 0,
    isFragile = false,
    paymentType = "PREPAID",
    distanceMilestoneId = null,
    pickupGeoZoneIds = [],
    deliveryGeoZoneIds = [],
    pickupPincodeTypeValues = {},
    deliveryPincodeTypeValues = {},
  } = context;

  const allRules = await prisma.chargeRule.findMany({
    where: { partnerId, isActive: true },
    include: {
      chargesType: { select: { id: true, name: true } },
      pincodeType: { select: { id: true, name: true, type: true } },
      zoneMilestone: {
        select: { id: true, minKm: true, maxKm: true, suffix: true },
      },
    },
    orderBy: [{ base: "asc" }],
  });

  // Apply semantic conditional gating — fragile, COD, prepaid, reverse
  const rules = allRules.filter((rule) =>
    shouldIncludeRule(rule, { isFragile, paymentType }),
  );

  logger.debug("Charge rules after conditional gating", {
    partnerId,
    totalRules: allRules.length,
    includedRules: rules.length,
    excludedCount: allRules.length - rules.length,
    paymentType,
    isFragile,
  });

  if (rules.length === 0) {
    return {
      totalCharge: 0,
      breakdown: [],
      message: "No active charge rules configured for this partner",
    };
  }

  // Group by category key:
  //   chargesType rules: "CT:<chargesTypeId>:<base>"
  //   pincodeType rules: "PT:<pincodeTypeId>:<base>"
  //   zone-to-zone / distance: "ZZ:<fromZoneId>:<toZoneId>" / "DIST:<zoneMilestoneId>"
  const categoryMap = new Map();

  for (const rule of rules) {
    let categoryKey;
    if (rule.pincodeTypeId) {
      categoryKey = `PT:${rule.pincodeTypeId}:${rule.base}`;
    } else if (rule.chargesTypeId) {
      categoryKey = `CT:${rule.chargesTypeId}:${rule.base}`;
    } else if (rule.base === "ZONE_TO_ZONE_WEIGHT") {
      categoryKey = `ZZ:${rule.fromZoneId}:${rule.toZoneId}`;
    } else if (rule.base === "DISTANCE_BASE_WEIGHT") {
      categoryKey = `DIST:${rule.zoneMilestoneId}`;
    } else {
      categoryKey = `MISC:${rule.base}:${rule.id}`;
    }

    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, []);
    }
    categoryMap.get(categoryKey).push(rule);
  }

  const breakdown = [];
  let totalCharge = 0;

  for (const [categoryKey, categoryRules] of categoryMap.entries()) {
    const firstRule = categoryRules[0];
    const isPincodeType = categoryKey.startsWith("PT:");

    if (isPincodeType) {
      // Evaluate per-side; only apply if the side has the pincodeType active
      const pincodeTypeId = firstRule.pincodeTypeId;
      const pincodeTypeDataType = firstRule.pincodeType?.type || "yes_no";

      const pickupActive = isPincodeTypeActive(
        pincodeTypeId,
        pincodeTypeDataType,
        pickupPincodeTypeValues,
      );
      const deliveryActive = isPincodeTypeActive(
        pincodeTypeId,
        pincodeTypeDataType,
        deliveryPincodeTypeValues,
      );

      if (!pickupActive && !deliveryActive) continue;

      let pickupResult = null;
      let deliveryResult = null;
      let pickupHighest = 0;
      let deliveryHighest = 0;

      for (const rule of categoryRules) {
        const base = rule.base;

        if (pickupActive) {
          const res = computeRuleCharge(
            rule,
            base,
            effectiveWeight,
            invoiceValue,
            distanceMilestoneId,
            pickupGeoZoneIds,
            deliveryGeoZoneIds,
          );
          if (res && res.totalCharge > pickupHighest) {
            pickupHighest = res.totalCharge;
            pickupResult = { ...res, side: "pickup" };
          }
        }

        if (deliveryActive) {
          const res = computeRuleCharge(
            rule,
            base,
            effectiveWeight,
            invoiceValue,
            distanceMilestoneId,
            pickupGeoZoneIds,
            deliveryGeoZoneIds,
          );
          if (res && res.totalCharge > deliveryHighest) {
            deliveryHighest = res.totalCharge;
            deliveryResult = { ...res, side: "delivery" };
          }
        }
      }

      const geoTotal = pickupHighest + deliveryHighest;
      if (geoTotal > 0) {
        breakdown.push({
          category: categoryKey,
          chargeTypeName: firstRule.pincodeType?.name || "Pincode Type Charge",
          base: firstRule.base,
          pickup: pickupResult,
          delivery: deliveryResult,
          totalCharge: Math.round(geoTotal * 100) / 100,
        });
        totalCharge += geoTotal;
      }
    } else {
      // Non-pincodeType: compute all matching rules, pick highest
      let highestCharge = 0;
      let highestResult = null;

      for (const rule of categoryRules) {
        const result = computeRuleCharge(
          rule,
          rule.base,
          effectiveWeight,
          invoiceValue,
          distanceMilestoneId,
          pickupGeoZoneIds,
          deliveryGeoZoneIds,
        );

        if (result && result.totalCharge > highestCharge) {
          highestCharge = result.totalCharge;
          highestResult = result;
        }
      }

      if (highestResult) {
        const chargeTypeName = firstRule.chargesType?.name || firstRule.base;

        breakdown.push({
          category: categoryKey,
          chargeTypeName,
          base: firstRule.base,
          ...highestResult,
          totalCharge: Math.round(highestCharge * 100) / 100,
        });
        totalCharge += highestCharge;
      }
    }
  }

  return {
    totalCharge: Math.round(totalCharge * 100) / 100,
    breakdown,
    rulesEvaluated: rules.length,
    categoriesMatched: breakdown.length,
  };
}

/**
 * Dispatch a single rule to the correct calculator.
 */
function computeRuleCharge(
  rule,
  base,
  effectiveWeight,
  invoiceValue,
  distanceMilestoneId,
  pickupZoneIds,
  deliveryZoneIds,
) {
  switch (base) {
    case "INVOICE_VALUE":
      return calcInvoiceValue(rule, invoiceValue);

    case "WEIGHT":
      return calcWeight(rule, effectiveWeight);

    case "ZONE_TO_ZONE_WEIGHT":
      return calcZoneToZoneWeight(
        rule,
        effectiveWeight,
        pickupZoneIds,
        deliveryZoneIds,
      );

    case "DISTANCE_BASE_WEIGHT":
      return calcDistanceBaseWeight(rule, effectiveWeight, distanceMilestoneId);

    default:
      logger.warn(`Unknown charge rule base: ${base}`);
      return null;
  }
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  calculateCharges,
  _helpers: {
    calcInvoiceValue,
    calcWeight,
    calcZoneToZoneWeight,
    calcDistanceBaseWeight,
    isPincodeTypeActive,
    shouldIncludeRule,
  },
};
