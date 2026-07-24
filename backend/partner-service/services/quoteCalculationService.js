/**
 * Quote Calculation Service
 *
 * Purpose: Calculate shipping quotes using the new Zone System v2
 * Integrates:
 * - Distance zones with milestones for serviceability
 * - Charge packages (WEIGHT/DISTANCE/GENERIC) for rate calculation
 * - Pincode types for location-based surcharges
 *
 * Following auth-service patterns with comprehensive error handling
 */

const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");

// Import services (lazy load to avoid circular dependencies)
let _distanceZoneService = null;
let _chargesRuleCalcService = null;
let _zoneCoverageValidationService = null;
let _chargeDiscountPackageService = null;
let _outletContextService = null;
let _carrierAccountService = null;

const getCarrierAccountService = () => {
  if (!_carrierAccountService) {
    _carrierAccountService = require("./carrierAccountService");
  }
  return _carrierAccountService;
};

const getDistanceZoneService = () => {
  if (!_distanceZoneService) {
    _distanceZoneService = require("./distanceZoneService");
  }
  return _distanceZoneService;
};

const getChargesRuleCalcService = () => {
  if (!_chargesRuleCalcService) {
    _chargesRuleCalcService = require("./chargesRuleCalculationService");
  }
  return _chargesRuleCalcService;
};

const getZoneCoverageValidationService = () => {
  if (!_zoneCoverageValidationService) {
    _zoneCoverageValidationService = require("./zoneCoverageValidationService");
  }
  return _zoneCoverageValidationService;
};

const getChargeDiscountPackageService = () => {
  if (!_chargeDiscountPackageService) {
    _chargeDiscountPackageService = require("./chargeDiscountPackageService");
  }
  return _chargeDiscountPackageService;
};

const getOutletContextService = () => {
  if (!_outletContextService) {
    _outletContextService = require("./outletContextService");
  }
  return _outletContextService;
};

// ==========================================
// CONSTANTS
// ==========================================

const CACHE_PREFIX = "quotes";
const CACHE_TTL = 300; // 5 minutes for quote results

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Generate cache key for quote request including all price-driving inputs
 */
function generateCacheKey(params) {
  const {
    fromPincode,
    toPincode,
    weight,
    paymentType,
    codAmount = 0,
    declaredValue = 0,
    dimensions,
    partnerId,
    sortBy = "cheapest",
    shipmentType = "B2C",
  } = params;

  const dimStr = dimensions
    ? `${dimensions.length}x${dimensions.width}x${dimensions.height}`
    : "0x0x0";

  const fragile = params.isFragile ? "1" : "0";
  return `${CACHE_PREFIX}:${fromPincode}:${toPincode}:${weight}:${paymentType}:${codAmount}:${declaredValue}:${dimStr}:${partnerId || "all"}:${sortBy}:f${fragile}:${shipmentType}`;
}

/**
 * Get GEOLOGICAL zone IDs for a pincode under a specific partner
 */
async function getGeoZoneIds(partnerId, pincode) {
  try {
    const zoneCoverageService = getZoneCoverageValidationService();
    const result = await zoneCoverageService.getZonesByPincode(
      partnerId,
      pincode,
    );
    if (!result.success || !result.zones) return [];
    const zoneIds = result.zones.map((z) => z.id);
    if (zoneIds.length === 0) return [];

    const geoZones = await prisma.zone.findMany({
      where: {
        id: { in: zoneIds },
        zoneType: "GEOLOGICAL",
      },
      select: { id: true },
    });
    return geoZones.map((z) => z.id);
  } catch (error) {
    logger.debug("Error getting geo zones for pincode", {
      partnerId,
      pincode,
      error: error.message,
    });
    return [];
  }
}

/**
 * Build a map of { [pincodeTypeId]: valueString } for a partner + pincode.
 * Returns {} if the pincode is not assigned to this partner.
 */
async function getPincodeTypeValues(partnerId, pincodeCode) {
  try {
    const pincode = await prisma.pincode.findUnique({
      where: { code: pincodeCode },
      select: { id: true },
    });
    if (!pincode) return {};

    const assign = await prisma.partnerPincodeAssign.findFirst({
      where: {
        partnerId,
        pincodeId: pincode.id,
        isActive: true,
      },
      include: {
        pincodeTypeValues: {
          select: { pincodeTypeId: true, value: true },
        },
      },
    });

    if (!assign) return {};

    const map = {};
    for (const v of assign.pincodeTypeValues) {
      map[v.pincodeTypeId] = v.value;
    }
    return map;
  } catch (error) {
    logger.debug("Error getting pincode type values", {
      partnerId,
      pincodeCode,
      error: error.message,
    });
    return {};
  }
}

/**
 * Check whether a partner has an active pincode assignment for a given pincode.
 * @param {string} partnerId
 * @param {string} pincodeCode - 6-digit pincode string
 * @returns {Promise<boolean>}
 */
async function hasPincodeAssignment(partnerId, pincodeCode) {
  try {
    const pincode = await prisma.pincode.findUnique({
      where: { code: pincodeCode },
      select: { id: true },
    });
    if (!pincode) return false;

    const assign = await prisma.partnerPincodeAssign.findFirst({
      where: {
        partnerId,
        pincodeId: pincode.id,
        isActive: true,
      },
      select: { id: true },
    });
    return !!assign;
  } catch (error) {
    logger.debug("Error checking pincode assignment", {
      partnerId,
      pincodeCode,
      error: error.message,
    });
    return false;
  }
}

/**
 * Check whether a partner has active zone coverage for a given pincode.
 * Looks for ANY active zone (GEOLOGICAL or DISTANCE) containing the pincode.
 * @param {string} partnerId
 * @param {string} pincodeCode
 * @returns {Promise<boolean>}
 */
async function hasZoneCoverage(partnerId, pincodeCode) {
  try {
    const zoneCoverageService = getZoneCoverageValidationService();
    const result = await zoneCoverageService.validatePincodeServiceability(
      partnerId,
      pincodeCode,
    );
    return result.success && result.serviceable;
  } catch (error) {
    logger.debug("Error checking zone coverage", {
      partnerId,
      pincodeCode,
      error: error.message,
    });
    return false;
  }
}

// ==========================================
// BADGE-BASED DISCOUNT APPLICATION
// ==========================================

/**
 * Apply charge discount package to a breakdown.
 *
 * Walks each breakdown entry and applies the matching discount config.
 * For non-PT entries: uses top-level ruleId.
 * For PT entries: matches pickup.ruleId and delivery.ruleId independently.
 *
 * Returns enriched breakdown with originalCharge/discount/finalCharge fields.
 *
 * @param {Array} breakdown - chargesResult.breakdown
 * @param {Object} discountPackage - package with items array
 * @returns {{ breakdown: Array, totalDiscount: number, originalTotal: number, finalTotal: number }}
 */
function applyDiscountsToBreakdown(breakdown, discountPackage) {
  if (
    !discountPackage ||
    !discountPackage.items ||
    discountPackage.items.length === 0
  ) {
    return {
      breakdown,
      totalDiscount: 0,
      originalTotal: breakdown.reduce(
        (sum, b) => sum + (b.totalCharge || 0),
        0,
      ),
      finalTotal: breakdown.reduce((sum, b) => sum + (b.totalCharge || 0), 0),
    };
  }

  // Build lookup map: chargeRuleId → { discountType, discountValue }
  const discountMap = new Map();
  for (const item of discountPackage.items) {
    discountMap.set(item.chargeRuleId, {
      discountType: item.discountType,
      discountValue: parseFloat(item.discountValue),
    });
  }

  let totalDiscount = 0;
  let originalTotal = 0;
  let finalTotal = 0;

  const enrichedBreakdown = breakdown.map((entry) => {
    const isPincodeType = entry.category && entry.category.startsWith("PT:");

    if (isPincodeType) {
      // Handle pickup and delivery sides independently
      let entryDiscount = 0;
      const enrichedEntry = { ...entry };

      if (entry.pickup && entry.pickup.ruleId) {
        const config = discountMap.get(entry.pickup.ruleId);
        if (config) {
          const originalCharge = entry.pickup.totalCharge || 0;
          const discountAmount = computeDiscountAmount(config, originalCharge);
          const finalCharge = Math.max(0, originalCharge - discountAmount);
          enrichedEntry.pickup = {
            ...entry.pickup,
            originalCharge,
            discount: {
              type: config.discountType,
              value: config.discountValue,
              amount: discountAmount,
              packageId: discountPackage.id,
              packageName: discountPackage.name,
            },
            finalCharge,
          };
          entryDiscount += discountAmount;
        }
      }

      if (entry.delivery && entry.delivery.ruleId) {
        const config = discountMap.get(entry.delivery.ruleId);
        if (config) {
          const originalCharge = entry.delivery.totalCharge || 0;
          const discountAmount = computeDiscountAmount(config, originalCharge);
          const finalCharge = Math.max(0, originalCharge - discountAmount);
          enrichedEntry.delivery = {
            ...entry.delivery,
            originalCharge,
            discount: {
              type: config.discountType,
              value: config.discountValue,
              amount: discountAmount,
              packageId: discountPackage.id,
              packageName: discountPackage.name,
            },
            finalCharge,
          };
          entryDiscount += discountAmount;
        }
      }

      const originalCharge = entry.totalCharge || 0;
      const finalCharge = Math.max(0, originalCharge - entryDiscount);
      enrichedEntry.originalCharge = originalCharge;
      enrichedEntry.totalCharge = Math.round(finalCharge * 100) / 100;
      enrichedEntry.discountAmount = Math.round(entryDiscount * 100) / 100;

      totalDiscount += entryDiscount;
      originalTotal += originalCharge;
      finalTotal += finalCharge;

      return enrichedEntry;
    } else {
      // Non-PT: use top-level ruleId
      const ruleId = entry.ruleId;
      const config = ruleId ? discountMap.get(ruleId) : null;
      const originalCharge = entry.totalCharge || 0;

      if (config) {
        const discountAmount = computeDiscountAmount(config, originalCharge);
        const finalCharge = Math.max(0, originalCharge - discountAmount);

        totalDiscount += discountAmount;
        originalTotal += originalCharge;
        finalTotal += finalCharge;

        return {
          ...entry,
          originalCharge,
          discount: {
            type: config.discountType,
            value: config.discountValue,
            amount: Math.round(discountAmount * 100) / 100,
            packageId: discountPackage.id,
            packageName: discountPackage.name,
          },
          totalCharge: Math.round(finalCharge * 100) / 100,
          discountAmount: Math.round(discountAmount * 100) / 100,
        };
      }

      originalTotal += originalCharge;
      finalTotal += originalCharge;
      return entry;
    }
  });

  return {
    breakdown: enrichedBreakdown,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    originalTotal: Math.round(originalTotal * 100) / 100,
    finalTotal: Math.round(finalTotal * 100) / 100,
  };
}

/**
 * Compute discount amount given config and original charge.
 * FLAT: min(value, originalCharge)
 * PERCENTAGE: originalCharge * value / 100
 */
function computeDiscountAmount(config, originalCharge) {
  if (config.discountType === "FLAT") {
    return Math.min(config.discountValue, originalCharge);
  }
  if (config.discountType === "PERCENTAGE") {
    return (originalCharge * config.discountValue) / 100;
  }
  return 0;
}

// ==========================================
// MAIN QUOTE CALCULATION
// ==========================================

/**
 * Check serviceability for multiple partners
 *
 * @param {Object} params - Serviceability check parameters
 * @param {string} params.fromPincode - Pickup pincode
 * @param {string} params.toPincode - Delivery pincode
 * @param {string} [params.partnerId] - Specific partner ID (optional)
 * @returns {Promise<Object>} Serviceability results
 */
async function checkServiceability(params) {
  const { fromPincode, toPincode, partnerId } = params;

  logger.info("Checking serviceability", { fromPincode, toPincode, partnerId });

  const distanceZoneService = getDistanceZoneService();

  // Get active partners
  const partnerWhere = { isActive: true };
  if (partnerId) {
    partnerWhere.id = partnerId;
  }

  const partners = await prisma.partner.findMany({
    where: partnerWhere,
    select: {
      id: true,
      name: true,
      displayName: true,
      defaultDeliveryDays: true,
    },
  });

  // Check serviceability for each partner — strict: both pickup and delivery
  // must have active pincode assignment AND zone coverage
  const results = await Promise.all(
    partners.map(async (partner) => {
      try {
        const [pickupAssigned, deliveryAssigned] = await Promise.all([
          hasPincodeAssignment(partner.id, fromPincode),
          hasPincodeAssignment(partner.id, toPincode),
        ]);

        if (!pickupAssigned) {
          return {
            partnerId: partner.id,
            partnerName: partner.displayName || partner.name,
            serviceable: false,
            reason: "Pickup pincode not assigned to this partner",
          };
        }
        if (!deliveryAssigned) {
          return {
            partnerId: partner.id,
            partnerName: partner.displayName || partner.name,
            serviceable: false,
            reason: "Delivery pincode not assigned to this partner",
          };
        }

        const [pickupCovered, deliveryCovered] = await Promise.all([
          hasZoneCoverage(partner.id, fromPincode),
          hasZoneCoverage(partner.id, toPincode),
        ]);

        if (!pickupCovered) {
          return {
            partnerId: partner.id,
            partnerName: partner.displayName || partner.name,
            serviceable: false,
            reason: "Pickup pincode has no active zone coverage",
          };
        }
        if (!deliveryCovered) {
          return {
            partnerId: partner.id,
            partnerName: partner.displayName || partner.name,
            serviceable: false,
            reason: "Delivery pincode has no active zone coverage",
          };
        }

        const zoneResult = await distanceZoneService.getZoneForShipment(
          partner.id,
          fromPincode,
          toPincode,
        );

        return {
          partnerId: partner.id,
          partnerName: partner.displayName || partner.name,
          serviceable: zoneResult.matched,
          distanceKm: zoneResult.distanceKm,
          zoneSuffix: zoneResult.zoneSuffix,
          zoneId: zoneResult.zone?.id,
          zoneName: zoneResult.zone?.name,
          estimatedDays: partner.defaultDeliveryDays,
          reason: zoneResult.matched ? undefined : "No matching distance zone",
        };
      } catch (error) {
        logger.warn("Serviceability check failed for partner", {
          partnerId: partner.id,
          error: error.message,
        });

        return {
          partnerId: partner.id,
          partnerName: partner.displayName || partner.name,
          serviceable: false,
          error: error.message,
        };
      }
    }),
  );

  return {
    fromPincode,
    toPincode,
    serviceability: results,
    serviceableCount: results.filter((r) => r.serviceable).length,
    totalPartners: results.length,
  };
}

/**
 * Calculate shipping rates for all serviceable partners
 *
 * @param {Object} params - Rate calculation parameters
 * @param {string} params.fromPincode - Pickup pincode
 * @param {string} params.toPincode - Delivery pincode
 * @param {number} params.weight - Package weight in kg
 * @param {Object} [params.dimensions] - Package dimensions (length, width, height in cm)
 * @param {string} [params.paymentType='PREPAID'] - Payment type (PREPAID, COD)
 * @param {number} [params.codAmount] - COD amount if paymentType is COD
 * @param {number} [params.declaredValue] - Declared value of shipment
 * @param {string} [params.partnerId] - Calculate for specific partner only
 * @param {string} [params.sortBy='cheapest'] - Sort order (cheapest, highest)
 * @param {Object} [params.userContext] - Authenticated user context for badge discounts
 * @param {string} [params.userContext.userId] - User ID
 * @param {string} [params.userContext.role] - User role (e.g. "outlet")
 * @returns {Promise<Object>} Rate calculation results with breakdown
 */
async function calculateRates(params) {
  const {
    fromPincode,
    toPincode,
    weight,
    dimensions,
    paymentType = "PREPAID",
    codAmount = 0,
    declaredValue = 0,
    isFragile = false,
    outletId = null,
    partnerId,
    sortBy = "cheapest",
    userContext,
    skipServiceabilityCheck = false,
    shipmentType = "B2C",
  } = params;

  logger.info("Calculating rates", {
    fromPincode,
    toPincode,
    weight,
    paymentType,
    partnerId,
    outletId,
  });

  // Resolve outlet badge — supports two scenarios:
  // 1. outletId explicitly provided (admin creating shipment on behalf of outlet)
  // 2. userContext.role === "outlet" (outlet user creating their own shipment)
  let outletBadge = null;

  if (outletId) {
    try {
      const outletContextService = getOutletContextService();
      const outletData =
        await outletContextService.resolveOutletBadgeById(outletId);
      if (outletData && outletData.badge) {
        outletBadge = outletData.badge;
        logger.debug("Outlet badge resolved by outletId for quote", {
          outletId,
          badge: outletBadge,
        });
      }
    } catch (error) {
      logger.warn(
        "Failed to resolve outlet badge by outletId, continuing without discounts",
        { outletId, error: error.message },
      );
    }
  } else if (
    userContext &&
    userContext.role === "outlet" &&
    userContext.userId
  ) {
    try {
      const outletContextService = getOutletContextService();
      const outletData = await outletContextService.resolveOutletBadge(
        userContext.userId,
      );
      if (outletData && outletData.badge) {
        outletBadge = outletData.badge;
        logger.debug("Outlet badge resolved by userId for quote", {
          userId: userContext.userId,
          badge: outletBadge,
        });
      }
    } catch (error) {
      logger.warn(
        "Failed to resolve outlet badge, continuing without discounts",
        { error: error.message },
      );
    }
  }

  // Check cache - skip when badge-based discounts apply
  const cacheKey = generateCacheKey({
    fromPincode,
    toPincode,
    weight,
    paymentType,
    codAmount,
    declaredValue,
    dimensions,
    partnerId,
    sortBy,
    isFragile,
    shipmentType,
  });
  const redis = getRedisClient();
  const skipCache = !!outletBadge;

  if (redis && !partnerId && !skipCache) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug("Returning cached quote", { cacheKey });
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn("Cache read error", { error: error.message });
    }
  }

  const distanceZoneService = getDistanceZoneService();
  const chargesRuleCalcService = getChargesRuleCalcService();

  // Calculate volumetric weight if dimensions provided
  let effectiveWeight = weight;
  if (
    dimensions &&
    dimensions.length &&
    dimensions.width &&
    dimensions.height
  ) {
    const volumetricWeight =
      (dimensions.length * dimensions.width * dimensions.height) / 5000;
    effectiveWeight = Math.max(weight, volumetricWeight);
  }

  // Get active partners
  const partnerWhere = { isActive: true };
  if (partnerId) {
    partnerWhere.id = partnerId;
  }

  const partners = await prisma.partner.findMany({
    where: partnerWhere,
    select: {
      id: true,
      name: true,
      displayName: true,
      defaultDeliveryDays: true,
    },
  });

  // Calculate rates for each partner
  const rates = await Promise.all(
    partners.map(async (partner) => {
      try {
        // When skipServiceabilityCheck is true (e.g. during rerate of an
        // existing shipment), we skip pincode-assignment and zone-coverage
        // gates because the shipment is already booked with this partner.
        if (!skipServiceabilityCheck) {
          const [pickupAssigned, deliveryAssigned] = await Promise.all([
            hasPincodeAssignment(partner.id, fromPincode),
            hasPincodeAssignment(partner.id, toPincode),
          ]);

          if (!pickupAssigned) {
            return {
              partnerId: partner.id,
              partnerName: partner.displayName || partner.name,
              serviceable: false,
              reason: "Pickup pincode not assigned to this partner",
            };
          }
          if (!deliveryAssigned) {
            return {
              partnerId: partner.id,
              partnerName: partner.displayName || partner.name,
              serviceable: false,
              reason: "Delivery pincode not assigned to this partner",
            };
          }

          const [pickupCovered, deliveryCovered] = await Promise.all([
            hasZoneCoverage(partner.id, fromPincode),
            hasZoneCoverage(partner.id, toPincode),
          ]);

          if (!pickupCovered) {
            return {
              partnerId: partner.id,
              partnerName: partner.displayName || partner.name,
              serviceable: false,
              reason: "Pickup pincode has no active zone coverage",
            };
          }
          if (!deliveryCovered) {
            return {
              partnerId: partner.id,
              partnerName: partner.displayName || partner.name,
              serviceable: false,
              reason: "Delivery pincode has no active zone coverage",
            };
          }
        }

        // Rule-based channel eligibility: a partner with service channels can
        // only quote when one matches the shipment profile (B2B/B2C + weight +
        // order amount + payment mode). Partners without channels stay on the
        // legacy path. Rerates (skipServiceabilityCheck) never hard-fail here.
        const channelSelection = await getCarrierAccountService().selectChannel(
          partner.id,
          {
            weight: effectiveWeight,
            businessType: shipmentType,
            orderAmount: declaredValue || null,
            paymentType,
          },
        );

        if (channelSelection.mode === "NO_MATCH" && !skipServiceabilityCheck) {
          return {
            partnerId: partner.id,
            partnerName: partner.displayName || partner.name,
            serviceable: false,
            reason:
              "No channel matches shipment profile (type/weight/amount/payment)",
          };
        }

        const matchedChannel =
          channelSelection.mode === "MATCHED" ? channelSelection.channel : null;

        // Recompute volumetric weight with the matched channel's divisor when
        // it differs from the default 5000
        let partnerEffectiveWeight = effectiveWeight;
        const channelDivisor = matchedChannel?.channelConfig?.volumetricDivisor;
        if (
          channelDivisor &&
          Number(channelDivisor) !== 5000 &&
          dimensions?.length &&
          dimensions?.width &&
          dimensions?.height
        ) {
          const channelVolumetricWeight =
            (dimensions.length * dimensions.width * dimensions.height) /
            Number(channelDivisor);
          partnerEffectiveWeight = Math.max(weight, channelVolumetricWeight);
        }

        // Distance zone matching for pricing context (DISTANCE_BASE_WEIGHT rules).
        // Do not hard-fail here: many partners price with WEIGHT / INVOICE_VALUE /
        // ZONE_TO_ZONE_WEIGHT only. Missing distance slabs must not block quotes.
        const zoneResult = await distanceZoneService.getZoneForShipment(
          partner.id,
          fromPincode,
          toPincode,
        );

        const distanceZoneUnmatched =
          !zoneResult.matched && !skipServiceabilityCheck;

        // Resolve GEOLOGICAL zone IDs and pincode-type values for both sides
        const [
          pickupGeoZoneIds,
          deliveryGeoZoneIds,
          pickupPincodeTypeValues,
          deliveryPincodeTypeValues,
        ] = await Promise.all([
          getGeoZoneIds(partner.id, fromPincode),
          getGeoZoneIds(partner.id, toPincode),
          getPincodeTypeValues(partner.id, fromPincode),
          getPincodeTypeValues(partner.id, toPincode),
        ]);

        // Build shipment context for the charge rule engine
        const chargeContext = {
          effectiveWeight: partnerEffectiveWeight,
          invoiceValue: declaredValue,
          isFragile,
          paymentType,
          distanceMilestoneId: zoneResult.milestone?.id || null,
          pickupGeoZoneIds,
          deliveryGeoZoneIds,
          pickupPincodeTypeValues,
          deliveryPincodeTypeValues,
        };

        // Calculate charges using the new charge rule engine
        const chargesResult = await chargesRuleCalcService.calculateCharges(
          partner.id,
          chargeContext,
        );

        let totalRate = chargesResult.totalCharge;
        let breakdownToUse = chargesResult.breakdown;
        let discountInfo = null;

        // Apply badge-based discounts if applicable
        if (outletBadge) {
          try {
            const discountPackageService = getChargeDiscountPackageService();
            const discountPackage =
              await discountPackageService.getActivePackageForBadge(
                partner.id,
                outletBadge,
              );

            if (discountPackage) {
              const discountResult = applyDiscountsToBreakdown(
                chargesResult.breakdown,
                discountPackage,
              );

              breakdownToUse = discountResult.breakdown;
              totalRate = discountResult.finalTotal;

              discountInfo = {
                packageId: discountPackage.id,
                packageName: discountPackage.name,
                badge: outletBadge,
                originalTotal: discountResult.originalTotal,
                totalDiscount: discountResult.totalDiscount,
                finalTotal: discountResult.finalTotal,
              };

              logger.debug("Badge discount applied", {
                partnerId: partner.id,
                badge: outletBadge,
                originalTotal: discountResult.originalTotal,
                discount: discountResult.totalDiscount,
                finalTotal: discountResult.finalTotal,
              });
            }
          } catch (discountError) {
            logger.warn(
              "Failed to apply badge discount, using undiscounted rate",
              {
                partnerId: partner.id,
                badge: outletBadge,
                error: discountError.message,
              },
            );
          }
        }

        if (distanceZoneUnmatched) {
          const hasPriced =
            totalRate > 0 ||
            (Array.isArray(breakdownToUse) && breakdownToUse.length > 0);
          if (!hasPriced) {
            return {
              partnerId: partner.id,
              partnerName: partner.displayName || partner.name,
              serviceable: false,
              reason:
                zoneResult.message ||
                "No matching distance zone and no applicable non-distance charge rules",
            };
          }
          logger.info(
            "Quoted partner without distance-zone match (non-distance rules produced a rate)",
            {
              partnerId: partner.id,
              fromPincode,
              toPincode,
              distanceKm: zoneResult.distanceKm,
              totalRate,
            },
          );
        }

        return {
          partnerId: partner.id,
          partnerName: partner.displayName || partner.name,
          serviceable: true,
          distanceKm: zoneResult.distanceKm,
          zoneSuffix: zoneResult.zoneSuffix,
          zoneName: zoneResult.zone?.name,
          estimatedDays: partner.defaultDeliveryDays,
          chargesBreakdown: breakdownToUse,
          rulesEvaluated: chargesResult.rulesEvaluated,
          categoriesMatched: chargesResult.categoriesMatched,
          totalRate,
          baseRate: totalRate,
          breakdown: breakdownToUse,
          ...(discountInfo && { discount: discountInfo }),
          ...(matchedChannel && {
            channel: {
              id: matchedChannel.id,
              channelName: matchedChannel.channelName,
              accountRef: matchedChannel.accountRef,
              serviceType: matchedChannel.serviceType,
              businessType: matchedChannel.businessType,
            },
          }),
        };
      } catch (error) {
        logger.warn("Rate calculation failed for partner", {
          partnerId: partner.id,
          error: error.message,
        });

        return {
          partnerId: partner.id,
          partnerName: partner.displayName || partner.name,
          serviceable: false,
          error: error.message,
        };
      }
    }),
  );

  // Filter serviceable rates
  const serviceableRates = rates.filter((r) => r.serviceable && !r.error);

  // Sort rates
  const sortedRates = [...serviceableRates].sort((a, b) => {
    if (sortBy === "highest") {
      return b.totalRate - a.totalRate;
    }
    return a.totalRate - b.totalRate; // cheapest (default)
  });

  // Find cheapest and fastest
  const cheapestRate =
    serviceableRates.length > 0
      ? serviceableRates.reduce((min, r) =>
          r.totalRate < min.totalRate ? r : min,
        )
      : null;

  const fastestRate =
    serviceableRates.length > 0
      ? serviceableRates.reduce((min, r) => {
          const rDays = r.estimatedDays || 999;
          const minDays = min.estimatedDays || 999;
          return rDays < minDays ? r : min;
        })
      : null;

  const result = {
    request: {
      fromPincode,
      toPincode,
      weight: effectiveWeight,
      paymentType,
      codAmount: paymentType === "COD" ? codAmount : undefined,
      declaredValue,
    },
    rates: sortedRates,
    allRates: rates, // Include non-serviceable for debugging
    cheapestRate,
    fastestRate,
    summary: {
      totalPartners: rates.length,
      serviceablePartners: serviceableRates.length,
      sortedBy: sortBy,
    },
    timestamp: new Date().toISOString(),
  };

  // Cache the result (skip when badge discounts are applied)
  if (redis && !partnerId && !skipCache && serviceableRates.length > 0) {
    try {
      await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (error) {
      logger.warn("Cache write error", { error: error.message });
    }
  }

  return result;
}

/**
 * Validate charges against business rules
 * Can be used to verify calculated charges
 *
 * @param {Object} chargeData - Charge data to validate
 * @param {Object} validationRules - Business rules to apply
 * @returns {Promise<Object>} Validation result
 */
async function validateCharges(chargeData, validationRules = {}) {
  const { totalRate, breakdown } = chargeData;
  const errors = [];
  const warnings = [];

  // Basic validation
  if (totalRate < 0) {
    errors.push("Total rate cannot be negative");
  }

  // Min/max rate validation
  if (validationRules.minRate && totalRate < validationRules.minRate) {
    warnings.push(
      `Total rate ${totalRate} is below minimum ${validationRules.minRate}`,
    );
  }

  if (validationRules.maxRate && totalRate > validationRules.maxRate) {
    warnings.push(
      `Total rate ${totalRate} exceeds maximum ${validationRules.maxRate}`,
    );
  }

  // Check for missing charge types
  if (breakdown) {
    if (breakdown.weight?.total === 0 && breakdown.distance?.total === 0) {
      warnings.push("No weight or distance charges calculated");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    chargeData,
  };
}

/**
 * Clear quote cache
 * @param {string} [pattern] - Optional pattern to match (e.g., pincode-based)
 */
async function clearCache(pattern = null) {
  try {
    const redis = getRedisClient();
    if (!redis) return { cleared: 0 };

    const searchPattern = pattern
      ? `${CACHE_PREFIX}:${pattern}*`
      : `${CACHE_PREFIX}:*`;
    const keys = await redis.keys(searchPattern);

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    logger.info("Quote cache cleared", { pattern, keysCleared: keys.length });
    return { cleared: keys.length };
  } catch (error) {
    logger.error("Error clearing quote cache", { error: error.message });
    throw error;
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  checkServiceability,
  calculateRates,
  validateCharges,
  clearCache,
};
