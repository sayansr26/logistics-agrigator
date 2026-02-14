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

const getDistanceZoneService = () => {
  if (!_distanceZoneService) {
    const DistanceZoneService = require("./distanceZoneService");
    _distanceZoneService = new DistanceZoneService();
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
    const ZoneCoverageValidationService = require("./zoneCoverageValidationService");
    _zoneCoverageValidationService = new ZoneCoverageValidationService();
  }
  return _zoneCoverageValidationService;
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
 * Generate cache key for quote request
 */
function generateCacheKey(params) {
  const { fromPincode, toPincode, weight, paymentType } = params;
  return `${CACHE_PREFIX}:${fromPincode}:${toPincode}:${weight}:${paymentType}`;
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
    // Filter to only GEOLOGICAL type zones
    // The zone model has zoneType field, but getZonesByPincode doesn't expose it.
    // We need to query zones directly.
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

  // Check serviceability for each partner
  const results = await Promise.all(
    partners.map(async (partner) => {
      try {
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
    partnerId,
    sortBy = "cheapest",
  } = params;

  logger.info("Calculating rates", {
    fromPincode,
    toPincode,
    weight,
    paymentType,
    partnerId,
  });

  // Check cache
  const cacheKey = generateCacheKey({
    fromPincode,
    toPincode,
    weight,
    paymentType,
  });
  const redis = getRedisClient();

  if (redis && !partnerId) {
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
        // Check serviceability via distance zone
        const zoneResult = await distanceZoneService.getZoneForShipment(
          partner.id,
          fromPincode,
          toPincode,
        );

        if (!zoneResult.matched) {
          return {
            partnerId: partner.id,
            partnerName: partner.displayName || partner.name,
            serviceable: false,
            reason: "No matching distance zone",
          };
        }

        // Resolve GEOLOGICAL zone IDs for pickup and delivery
        const [pickupGeoZoneIds, deliveryGeoZoneIds] = await Promise.all([
          getGeoZoneIds(partner.id, fromPincode),
          getGeoZoneIds(partner.id, toPincode),
        ]);

        // Build shipment context for the new charges rule engine
        const chargeContext = {
          effectiveWeight,
          invoiceValue: declaredValue,
          distanceKm: zoneResult.distanceKm,
          divisionSuffix: zoneResult.zoneSuffix,
          pickupGeoZoneIds,
          deliveryGeoZoneIds,
        };

        // Calculate charges using the new charge rule engine
        const chargesResult = await chargesRuleCalcService.calculateCharges(
          partner.id,
          chargeContext,
        );

        const totalRate = chargesResult.totalCharge;

        return {
          partnerId: partner.id,
          partnerName: partner.displayName || partner.name,
          serviceable: true,
          distanceKm: zoneResult.distanceKm,
          zoneSuffix: zoneResult.zoneSuffix,
          zoneName: zoneResult.zone?.name,
          estimatedDays: partner.defaultDeliveryDays,
          chargesBreakdown: chargesResult.breakdown,
          rulesEvaluated: chargesResult.rulesEvaluated,
          categoriesMatched: chargesResult.categoriesMatched,
          totalRate,
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

  // Cache the result
  if (redis && !partnerId && serviceableRates.length > 0) {
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
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
