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
let _pincodeTypeService = null;
let _chargePackageService = null;

const getDistanceZoneService = () => {
  if (!_distanceZoneService) {
    const DistanceZoneService = require("./distanceZoneService");
    _distanceZoneService = new DistanceZoneService();
  }
  return _distanceZoneService;
};

const getPincodeTypeService = () => {
  if (!_pincodeTypeService) {
    // pincodeTypeService exports a singleton instance, not the class
    _pincodeTypeService = require("./pincodeTypeService");
  }
  return _pincodeTypeService;
};

const getChargePackageService = () => {
  if (!_chargePackageService) {
    _chargePackageService = require("./chargePackageService");
  }
  return _chargePackageService;
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
 * Calculate charge for a WEIGHT package
 * Formula: baseCharge + (ceil((weight - baseUnit) / addonUnit) * addonCharge)
 */
function calculateWeightCharge(pkg, weightKg) {
  const baseCharge = parseFloat(pkg.baseCharge);
  const baseUnit = parseFloat(pkg.baseUnit) || 0;
  const addonUnit = parseFloat(pkg.addonUnit) || 1;
  const addonCharge = parseFloat(pkg.addonCharge) || 0;

  if (weightKg <= baseUnit) {
    return {
      packageId: pkg.id,
      packageName: pkg.name,
      type: "WEIGHT",
      baseCharge,
      addonCharge: 0,
      addonUnits: 0,
      totalCharge: baseCharge,
      calculation: `Base charge for up to ${baseUnit}kg`,
    };
  }

  const extraWeight = weightKg - baseUnit;
  const addonUnits = Math.ceil(extraWeight / addonUnit);
  const addonTotal = addonUnits * addonCharge;
  const totalCharge = baseCharge + addonTotal;

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    type: "WEIGHT",
    baseCharge,
    addonCharge: addonTotal,
    addonUnits,
    totalCharge,
    calculation: `${baseCharge} (base) + ${addonUnits} x ${addonCharge} (${extraWeight.toFixed(2)}kg extra)`,
  };
}

/**
 * Calculate charge for a DISTANCE package
 * Formula: baseCharge + (ceil((distance - baseUnit) / addonUnit) * addonCharge)
 */
function calculateDistanceCharge(pkg, distanceKm) {
  const baseCharge = parseFloat(pkg.baseCharge);
  const baseUnit = parseFloat(pkg.baseUnit) || 0;
  const addonUnit = parseFloat(pkg.addonUnit) || 1;
  const addonCharge = parseFloat(pkg.addonCharge) || 0;

  if (distanceKm <= baseUnit) {
    return {
      packageId: pkg.id,
      packageName: pkg.name,
      type: "DISTANCE",
      baseCharge,
      addonCharge: 0,
      addonUnits: 0,
      totalCharge: baseCharge,
      calculation: `Base charge for up to ${baseUnit}km`,
    };
  }

  const extraDistance = distanceKm - baseUnit;
  const addonUnits = Math.ceil(extraDistance / addonUnit);
  const addonTotal = addonUnits * addonCharge;
  const totalCharge = baseCharge + addonTotal;

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    type: "DISTANCE",
    baseCharge,
    addonCharge: addonTotal,
    addonUnits,
    totalCharge,
    calculation: `${baseCharge} (base) + ${addonUnits} x ${addonCharge} (${extraDistance.toFixed(2)}km extra)`,
  };
}

/**
 * Calculate charge for a GENERIC package
 * Currently only supports FLAT calc type
 */
function calculateGenericCharge(
  pkg,
  paymentType,
  codAmount = 0,
  declaredValue = 0,
) {
  const baseCharge = parseFloat(pkg.baseCharge);
  const appliesTo = pkg.appliesTo || "ANY";
  const calcType = pkg.calcType || "FLAT";

  // Check if package applies to this payment type
  const paymentTypeUpper = paymentType?.toUpperCase() || "PREPAID";
  if (appliesTo !== "ANY" && appliesTo !== paymentTypeUpper) {
    return null; // Package doesn't apply
  }

  let totalCharge = baseCharge;
  let calculation = `${pkg.name}: ${baseCharge}`;

  // Future: support percentage-based calculations
  if (calcType === "PERCENTAGE_OF_COD" && codAmount > 0) {
    totalCharge = (baseCharge / 100) * codAmount;
    calculation = `${pkg.name}: ${baseCharge}% of COD ₹${codAmount}`;
  } else if (calcType === "PERCENTAGE_OF_DECLARED_VALUE" && declaredValue > 0) {
    totalCharge = (baseCharge / 100) * declaredValue;
    calculation = `${pkg.name}: ${baseCharge}% of declared value ₹${declaredValue}`;
  }

  return {
    packageId: pkg.id,
    packageName: pkg.name,
    type: "GENERIC",
    appliesTo,
    calcType,
    baseCharge,
    totalCharge,
    calculation,
  };
}

/**
 * Generate cache key for quote request
 */
function generateCacheKey(params) {
  const { fromPincode, toPincode, weight, paymentType } = params;
  return `${CACHE_PREFIX}:${fromPincode}:${toPincode}:${weight}:${paymentType}`;
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
  const pincodeTypeService = getPincodeTypeService();
  const chargePackageService = getChargePackageService();

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

        // Get partner-specific pincode type charges for both locations
        let pickupTypeCharges = { totalCharge: 0, activeTypes: [] };
        let deliveryTypeCharges = { totalCharge: 0, activeTypes: [] };

        try {
          pickupTypeCharges = await pincodeTypeService.getTypesByPincode(
            fromPincode,
            partner.id, // Partner-specific lookup
          );
        } catch (error) {
          logger.debug("No pincode type for pickup", {
            fromPincode,
            partnerId: partner.id,
            error: error.message,
          });
        }

        try {
          deliveryTypeCharges = await pincodeTypeService.getTypesByPincode(
            toPincode,
            partner.id, // Partner-specific lookup
          );
        } catch (error) {
          logger.debug("No pincode type for delivery", {
            toPincode,
            partnerId: partner.id,
            error: error.message,
          });
        }

        const pincodeTypeCharge =
          pickupTypeCharges.totalCharge + deliveryTypeCharges.totalCharge;

        // Get partner's charge packages
        const packages = await chargePackageService.getPackagesByPartner(
          partner.id,
          {
            isActive: true,
          },
        );

        if (packages.length === 0) {
          return {
            partnerId: partner.id,
            partnerName: partner.displayName || partner.name,
            serviceable: true,
            error: "No charge packages configured for partner",
          };
        }

        // Calculate charges from packages
        const breakdown = {
          weightCharges: [],
          distanceCharges: [],
          genericCharges: [],
        };

        let totalWeightCharge = 0;
        let totalDistanceCharge = 0;
        let totalGenericCharge = 0;

        for (const pkg of packages) {
          if (pkg.type === "WEIGHT") {
            const charge = calculateWeightCharge(pkg, effectiveWeight);
            breakdown.weightCharges.push(charge);
            totalWeightCharge += charge.totalCharge;
          } else if (pkg.type === "DISTANCE") {
            const charge = calculateDistanceCharge(pkg, zoneResult.distanceKm);
            breakdown.distanceCharges.push(charge);
            totalDistanceCharge += charge.totalCharge;
          } else if (pkg.type === "GENERIC") {
            const charge = calculateGenericCharge(
              pkg,
              paymentType,
              codAmount,
              declaredValue,
            );
            if (charge) {
              breakdown.genericCharges.push(charge);
              totalGenericCharge += charge.totalCharge;
            }
          }
        }

        // Calculate total rate
        const baseRate =
          totalWeightCharge + totalDistanceCharge + totalGenericCharge;
        const totalRate = baseRate + pincodeTypeCharge;

        return {
          partnerId: partner.id,
          partnerName: partner.displayName || partner.name,
          serviceable: true,
          distanceKm: zoneResult.distanceKm,
          zoneSuffix: zoneResult.zoneSuffix,
          zoneName: zoneResult.zone?.name,
          estimatedDays: partner.defaultDeliveryDays,
          breakdown: {
            weight: {
              effectiveWeight,
              charges: breakdown.weightCharges,
              total: totalWeightCharge,
            },
            distance: {
              distanceKm: zoneResult.distanceKm,
              charges: breakdown.distanceCharges,
              total: totalDistanceCharge,
            },
            generic: {
              charges: breakdown.genericCharges,
              total: totalGenericCharge,
            },
            pincodeType: {
              pickup: {
                charges: pickupTypeCharges.activeTypes,
                total: pickupTypeCharges.totalCharge,
              },
              delivery: {
                charges: deliveryTypeCharges.activeTypes,
                total: deliveryTypeCharges.totalCharge,
              },
              total: pincodeTypeCharge,
            },
          },
          baseRate,
          pincodeTypeCharge,
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
  // Export helpers for testing
  _helpers: {
    calculateWeightCharge,
    calculateDistanceCharge,
    calculateGenericCharge,
  },
};
