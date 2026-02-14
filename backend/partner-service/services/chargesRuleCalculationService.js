/**
 * Charges Rule Calculation Service
 *
 * Calculates shipping charges using the new ChargeRule model.
 * Replaces legacy ChargePackage-based calculation.
 *
 * Calculation rules:
 * - Multiple charge rules can apply to one shipment → apply all and show breakdown.
 * - Within a single charge category (same partner + kind + chargesTypeId/pincodeTypeId + base),
 *   if multiple slabs match → compute all and pick the HIGHEST computed charge.
 * - GEOLOGICAL charges: evaluate pickup and delivery independently and SUM both sides.
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");

// ========================================
// INDIVIDUAL CHARGE CALCULATORS
// ========================================

/**
 * Calculate charge for INVOICE_VALUE base rule
 * @param {Object} rule - ChargeRule record
 * @param {number} invoiceValue - Declared/invoice value
 * @returns {Object|null} Computed charge or null if rule doesn't match
 */
function calcInvoiceValue(rule, invoiceValue) {
  const from = parseFloat(rule.fromAmount) || 0;
  const to = parseFloat(rule.toAmount) || Infinity;
  const charge = parseFloat(rule.charge) || 0;

  if (invoiceValue < from || invoiceValue > to) {
    return null; // Doesn't match the slab
  }

  let totalCharge;
  if (rule.calcType === "PERCENTAGE") {
    totalCharge = (charge / 100) * invoiceValue;
  } else {
    totalCharge = charge;
  }

  return {
    ruleId: rule.id,
    base: "INVOICE_VALUE",
    calcType: rule.calcType,
    slab: `₹${from} - ₹${to}`,
    chargeValue: charge,
    totalCharge: Math.round(totalCharge * 100) / 100,
    calculation:
      rule.calcType === "PERCENTAGE"
        ? `${charge}% of ₹${invoiceValue}`
        : `Flat ₹${charge}`,
  };
}

/**
 * Calculate charge for WEIGHT base rule
 * @param {Object} rule - ChargeRule record
 * @param {number} weightKg - Effective weight in kg
 * @returns {Object|null}
 */
function calcWeight(rule, weightKg) {
  const minKg = parseFloat(rule.minKg) || 0;
  const maxKg = parseFloat(rule.maxKg) || Infinity;
  const charge = parseFloat(rule.charge) || 0;

  if (weightKg < minKg || weightKg > maxKg) {
    return null;
  }

  let totalCharge;
  if (rule.calcType === "PERCENTAGE") {
    // Percentage of weight? Unusual, but supported. Treat as percentage of charge base.
    totalCharge = (charge / 100) * weightKg;
  } else {
    totalCharge = charge;
  }

  return {
    ruleId: rule.id,
    base: "WEIGHT",
    calcType: rule.calcType,
    slab: `${minKg}kg - ${maxKg}kg`,
    chargeValue: charge,
    totalCharge: Math.round(totalCharge * 100) / 100,
    calculation:
      rule.calcType === "PERCENTAGE"
        ? `${charge}% of ${weightKg}kg`
        : `Flat ₹${charge} for ${minKg}-${maxKg}kg`,
  };
}

/**
 * Calculate charge for ZONE_TO_ZONE_WEIGHT base rule
 * Formula: weightCharge + addonCharge * ceil((weight - minWeight) / addonWeight)
 * @param {Object} rule - ChargeRule record
 * @param {number} weightKg - Effective weight in kg
 * @param {string} pickupZoneId - Pickup geological zone ID
 * @param {string} deliveryZoneId - Delivery geological zone ID
 * @returns {Object|null}
 */
function calcZoneToZoneWeight(rule, weightKg, pickupZoneId, deliveryZoneId) {
  // Match fromZoneId -> pickupZoneId, toZoneId -> deliveryZoneId
  if (rule.fromZoneId !== pickupZoneId || rule.toZoneId !== deliveryZoneId) {
    return null;
  }

  const minWeightKg = parseFloat(rule.minWeightKg) || 0;
  const addonWeightKg = parseFloat(rule.addonWeightKg) || 1;
  const wCharge = parseFloat(rule.weightCharge) || 0;
  const aCharge = parseFloat(rule.addonCharge) || 0;

  let totalCharge;
  let calculation;

  if (weightKg <= minWeightKg) {
    totalCharge = wCharge;
    calculation = `Base weight charge ₹${wCharge} for up to ${minWeightKg}kg`;
  } else {
    const extra = weightKg - minWeightKg;
    const addonUnits = Math.ceil(extra / addonWeightKg);
    const addonTotal = addonUnits * aCharge;
    totalCharge = wCharge + addonTotal;
    calculation = `₹${wCharge} (base) + ${addonUnits} × ₹${aCharge} (${extra.toFixed(2)}kg extra)`;
  }

  return {
    ruleId: rule.id,
    base: "ZONE_TO_ZONE_WEIGHT",
    fromZoneId: rule.fromZoneId,
    toZoneId: rule.toZoneId,
    totalCharge: Math.round(totalCharge * 100) / 100,
    calculation,
  };
}

/**
 * Calculate charge for DISTANCE_BASE_WEIGHT base rule
 * Formula: weightCharge + addonCharge * ceil((weight - minWeight) / addonWeight)
 * @param {Object} rule - ChargeRule record
 * @param {number} weightKg - Effective weight in kg
 * @param {number} distanceKm - Distance in km
 * @param {string} divisionSuffix - Zone division/suffix (e.g., "A", "B")
 * @returns {Object|null}
 */
function calcDistanceBaseWeight(rule, weightKg, distanceKm, divisionSuffix) {
  // Match division
  if (rule.division && divisionSuffix && rule.division !== divisionSuffix) {
    return null;
  }

  // Match distance range
  const fromKm = rule.fromKm || 0;
  const toKm = rule.toKm || Infinity;
  if (distanceKm < fromKm || distanceKm > toKm) {
    return null;
  }

  const minWeightKg = parseFloat(rule.minWeightKg) || 0;
  const addonWeightKg = parseFloat(rule.addonWeightKg) || 1;
  const wCharge = parseFloat(rule.weightCharge) || 0;
  const aCharge = parseFloat(rule.addonCharge) || 0;

  let totalCharge;
  let calculation;

  if (weightKg <= minWeightKg) {
    totalCharge = wCharge;
    calculation = `Base charge ₹${wCharge} for ${fromKm}-${toKm}km, up to ${minWeightKg}kg`;
  } else {
    const extra = weightKg - minWeightKg;
    const addonUnits = Math.ceil(extra / addonWeightKg);
    const addonTotal = addonUnits * aCharge;
    totalCharge = wCharge + addonTotal;
    calculation = `₹${wCharge} (base) + ${addonUnits} × ₹${aCharge} for ${fromKm}-${toKm}km`;
  }

  return {
    ruleId: rule.id,
    base: "DISTANCE_BASE_WEIGHT",
    division: rule.division,
    distanceRange: `${fromKm}-${toKm}km`,
    totalCharge: Math.round(totalCharge * 100) / 100,
    calculation,
  };
}

// ========================================
// MAIN CALCULATION ENGINE
// ========================================

/**
 * Calculate all charges for a partner given shipment context.
 *
 * @param {string} partnerId - Partner CUID
 * @param {Object} context - Shipment context
 * @param {number} context.effectiveWeight - Max of dead/volumetric weight (kg)
 * @param {number} context.invoiceValue - Declared value
 * @param {number} context.distanceKm - Distance between pickup/delivery (km)
 * @param {string} context.divisionSuffix - Zone milestone suffix (e.g., "A")
 * @param {string[]} context.pickupGeoZoneIds - GEOLOGICAL zone IDs covering pickup pincode
 * @param {string[]} context.deliveryGeoZoneIds - GEOLOGICAL zone IDs covering delivery pincode
 * @param {Object} context.pickupPincodeTypeValues - Map of pincodeTypeId → value for pickup
 * @param {Object} context.deliveryPincodeTypeValues - Map of pincodeTypeId → value for delivery
 * @returns {Promise<Object>} { totalCharge, breakdown[] }
 */
async function calculateCharges(partnerId, context) {
  const {
    effectiveWeight = 0,
    invoiceValue = 0,
    distanceKm = 0,
    divisionSuffix = null,
    pickupGeoZoneIds = [],
    deliveryGeoZoneIds = [],
  } = context;

  // Fetch all active rules for this partner
  const rules = await prisma.chargeRule.findMany({
    where: {
      partnerId,
      isActive: true,
    },
    include: {
      chargesType: { select: { id: true, name: true } },
      pincodeType: { select: { id: true, name: true, type: true } },
    },
    orderBy: [{ kind: "asc" }, { base: "asc" }],
  });

  if (rules.length === 0) {
    return {
      totalCharge: 0,
      breakdown: [],
      message: "No active charge rules configured for this partner",
    };
  }

  // Group rules by category key: kind + chargesTypeId/pincodeTypeId + base
  // Within each group, compute all matches and pick the highest.
  // Exception: GEOLOGICAL rules are evaluated per side (pickup/delivery) and summed.

  const categoryMap = new Map();

  for (const rule of rules) {
    let categoryKey;
    if (rule.kind === "GEOLOGICAL") {
      // GEOLOGICAL rules are handled separately per-side
      categoryKey = `GEO:${rule.pincodeTypeId || "none"}:${rule.base}`;
    } else {
      categoryKey = `${rule.kind}:${rule.chargesTypeId || rule.pincodeTypeId || "none"}:${rule.base}`;
    }

    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, []);
    }
    categoryMap.get(categoryKey).push(rule);
  }

  const breakdown = [];
  let totalCharge = 0;

  for (const [categoryKey, categoryRules] of categoryMap.entries()) {
    const isGeo = categoryKey.startsWith("GEO:");
    const firstRule = categoryRules[0];
    const base = firstRule.base;

    if (isGeo) {
      // GEOLOGICAL: evaluate pickup side and delivery side independently, sum both
      let pickupHighest = 0;
      let deliveryHighest = 0;
      let pickupResult = null;
      let deliveryResult = null;

      for (const rule of categoryRules) {
        // Pickup side: check if rule zones match pickup zones
        const pickupMatch = computeRuleCharge(
          rule,
          base,
          effectiveWeight,
          invoiceValue,
          distanceKm,
          divisionSuffix,
          pickupGeoZoneIds,
          pickupGeoZoneIds, // For zone-to-zone, use same side
        );

        if (pickupMatch && pickupMatch.totalCharge > pickupHighest) {
          pickupHighest = pickupMatch.totalCharge;
          pickupResult = {
            ...pickupMatch,
            side: "pickup",
          };
        }

        // Delivery side
        const deliveryMatch = computeRuleCharge(
          rule,
          base,
          effectiveWeight,
          invoiceValue,
          distanceKm,
          divisionSuffix,
          deliveryGeoZoneIds,
          deliveryGeoZoneIds,
        );

        if (deliveryMatch && deliveryMatch.totalCharge > deliveryHighest) {
          deliveryHighest = deliveryMatch.totalCharge;
          deliveryResult = {
            ...deliveryMatch,
            side: "delivery",
          };
        }
      }

      const geoTotal = pickupHighest + deliveryHighest;
      if (geoTotal > 0) {
        const chargeTypeName =
          firstRule.pincodeType?.name || "Geological Charge";

        breakdown.push({
          category: categoryKey,
          kind: firstRule.kind,
          chargeTypeName,
          base,
          pickup: pickupResult,
          delivery: deliveryResult,
          totalCharge: Math.round(geoTotal * 100) / 100,
        });
        totalCharge += geoTotal;
      }
    } else {
      // Non-GEOLOGICAL: compute all matching slabs, pick highest
      let highestCharge = 0;
      let highestResult = null;

      for (const rule of categoryRules) {
        const result = computeRuleCharge(
          rule,
          base,
          effectiveWeight,
          invoiceValue,
          distanceKm,
          divisionSuffix,
          pickupGeoZoneIds,
          deliveryGeoZoneIds,
        );

        if (result && result.totalCharge > highestCharge) {
          highestCharge = result.totalCharge;
          highestResult = result;
        }
      }

      if (highestResult) {
        const chargeTypeName =
          firstRule.chargesType?.name ||
          (firstRule.kind === "ADDON" ? "Addon Charge" : firstRule.kind);

        breakdown.push({
          category: categoryKey,
          kind: firstRule.kind,
          chargeTypeName,
          base,
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
 * Compute charge for a single rule based on its base type.
 *
 * @returns {Object|null} charge result or null if doesn't match
 */
function computeRuleCharge(
  rule,
  base,
  effectiveWeight,
  invoiceValue,
  distanceKm,
  divisionSuffix,
  pickupZoneIds,
  deliveryZoneIds,
) {
  switch (base) {
    case "INVOICE_VALUE":
      return calcInvoiceValue(rule, invoiceValue);

    case "WEIGHT":
      return calcWeight(rule, effectiveWeight);

    case "ZONE_TO_ZONE_WEIGHT":
      // Try all combinations of pickup × delivery zones
      for (const pZoneId of pickupZoneIds) {
        for (const dZoneId of deliveryZoneIds) {
          const result = calcZoneToZoneWeight(
            rule,
            effectiveWeight,
            pZoneId,
            dZoneId,
          );
          if (result) return result;
        }
      }
      return null;

    case "DISTANCE_BASE_WEIGHT":
      return calcDistanceBaseWeight(
        rule,
        effectiveWeight,
        distanceKm,
        divisionSuffix,
      );

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
  // Export calculators for testing
  _helpers: {
    calcInvoiceValue,
    calcWeight,
    calcZoneToZoneWeight,
    calcDistanceBaseWeight,
  },
};
