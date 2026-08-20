/**
 * Quote Service (Charges Engine v3)
 *
 * Orchestrates quote calculation across partners:
 *   serviceability gates → channel selection → volumetric recompute →
 *   distance zone → facts assembly → chargeEngine pipeline → envelope.
 *
 * Replaces quoteCalculationService.js (G2). The response envelope preserves
 * every field shipment-service consumes and adds:
 *   pricing            — money split incl. GST-inclusive grandTotal
 *   requiredQuestions  — booking-question specs priced for this partner
 *   engine             — { version, configRevision } for quoteSnapshot traceability
 *
 * NOTE: totalRate is GST-INCLUSIVE (grandTotal) in v3.
 */

const crypto = require("crypto");
const { prisma } = require("../config/database");
const logger = require("../shared/lib/logger");
const { getRedisClient } = require("../config/redis");
const weightCalc = require("../shared/utils/weightCalc");
const { canonicalTypeName } = require("../utils/typeNameNormalizer");
const { getConfigRevision } = require("./chargeConfigShared");
const contextBuilder = require("./chargeEngine/contextBuilder");
const pipeline = require("./chargeEngine/pipeline");
const { createAdapter } = require("../adapters/AdapterFactory");

// Lazy service loading (avoids circular dependencies)
let _distanceZoneService = null;
let _zoneCoverageValidationService = null;
let _outletContextService = null;
let _carrierAccountService = null;
let _partnerChargeConfigService = null;

const getDistanceZoneService = () =>
  (_distanceZoneService ||= require("./distanceZoneService"));
const getZoneCoverageValidationService = () =>
  (_zoneCoverageValidationService ||= require("./zoneCoverageValidationService"));
const getOutletContextService = () =>
  (_outletContextService ||= require("./outletContextService"));
const getCarrierAccountService = () =>
  (_carrierAccountService ||= require("./carrierAccountService"));
const getPartnerChargeConfigService = () =>
  (_partnerChargeConfigService ||= require("./partnerChargeConfigService"));

const CACHE_PREFIX = "quotes:v3";
const CACHE_TTL = 300; // 5 minutes

// ==========================================
// HELPERS
// ==========================================

function hashVasSelections(vasSelections = []) {
  if (!Array.isArray(vasSelections) || vasSelections.length === 0)
    return "none";
  const canonical = [...vasSelections]
    .map((s) => ({ chargeCode: s.chargeCode, answer: s.answer }))
    .sort((a, b) => a.chargeCode.localeCompare(b.chargeCode));
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex")
    .slice(0, 16);
}

function generateCacheKey(params, configRevision) {
  const {
    fromPincode,
    toPincode,
    weight,
    paymentType,
    codAmount = 0,
    declaredValue = 0,
    dimensions,
    numberOfBoxes = 1,
    partnerId,
    sortBy = "cheapest",
    shipmentType = "B2C",
    shipmentDirection = "FORWARD",
    vasSelections,
  } = params;

  const dimStr = dimensions
    ? `${dimensions.length}x${dimensions.width}x${dimensions.height}`
    : "0x0x0";
  const fragile = params.isFragile ? "1" : "0";
  const vasHash = hashVasSelections(vasSelections);

  return `${CACHE_PREFIX}:r${configRevision}:${fromPincode}:${toPincode}:${weight}:${paymentType}:${codAmount}:${declaredValue}:${dimStr}:b${numberOfBoxes}:${partnerId || "all"}:${sortBy}:f${fragile}:${shipmentType}:${shipmentDirection}:v${vasHash}`;
}

async function hasPincodeAssignment(partnerId, pincodeCode) {
  try {
    const pincode = await prisma.pincode.findUnique({
      where: { code: pincodeCode },
      select: { id: true },
    });
    if (!pincode) return false;

    const assign = await prisma.partnerPincodeAssign.findFirst({
      where: { partnerId, pincodeId: pincode.id, isActive: true },
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

async function hasZoneCoverage(partnerId, pincodeCode) {
  try {
    const result =
      await getZoneCoverageValidationService().validatePincodeServiceability(
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

/**
 * Mode-of-transport code for the carrier TAT lookup, preferring the matched
 * channel's own service type over the shipment's requested one.
 */
function resolveTatMode(channelServiceType, serviceType) {
  const value = String(channelServiceType || serviceType || "").toUpperCase();
  if (value === "AIR" || value === "EXPRESS") return "E";
  return "S";
}

/**
 * Expected transit time from the carrier for this lane.
 *
 * Best-effort only: a partner without an aggregator, without credentials, or
 * whose API is down still gets quoted — the caller falls back to the
 * partner's configured default delivery days.
 *
 * @returns {Promise<{days: number|null, expectedDeliveryDate: string|null}|null>}
 */
async function getCarrierTat({
  channel,
  fromPincode,
  toPincode,
  shipmentType,
  serviceType,
}) {
  if (!channel?.id) return null;

  try {
    const credentials =
      await getCarrierAccountService().resolveChannelCredentials(channel.id);
    const adapter = createAdapter(credentials);
    if (!adapter) return null;

    return await adapter.getExpectedTat({
      originPin: fromPincode,
      destinationPin: toPincode,
      mode: resolveTatMode(channel.serviceType, serviceType),
      productType: shipmentType === "B2B" ? "B2B" : "B2C",
    });
  } catch (error) {
    // Missing credentials, unsupported aggregator, carrier outage — none of
    // these should cost the partner its place in the quote list.
    logger.debug("Carrier TAT lookup unavailable", {
      channelId: channel.id,
      error: error.message,
    });
    return null;
  }
}

async function getGeoZoneIds(partnerId, pincode) {
  try {
    const result = await getZoneCoverageValidationService().getZonesByPincode(
      partnerId,
      pincode,
    );
    if (!result.success || !result.zones) return [];
    const zoneIds = result.zones.map((z) => z.id);
    if (zoneIds.length === 0) return [];

    const geoZones = await prisma.zone.findMany({
      where: { id: { in: zoneIds }, zoneType: "GEOLOGICAL" },
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
 * Pincode-type values for a partner+pincode, keyed by CANONICAL type name
 * (e.g. { ODA: "yes", HILL: "no" }) for the facts registry.
 */
async function getPincodeTypeValuesByName(
  partnerId,
  pincodeCode,
  typeNameById,
) {
  try {
    const pincode = await prisma.pincode.findUnique({
      where: { code: pincodeCode },
      select: { id: true },
    });
    if (!pincode) return {};

    const assign = await prisma.partnerPincodeAssign.findFirst({
      where: { partnerId, pincodeId: pincode.id, isActive: true },
      include: {
        pincodeTypeValues: { select: { pincodeTypeId: true, value: true } },
      },
    });
    if (!assign) return {};

    const map = {};
    for (const v of assign.pincodeTypeValues) {
      const name = typeNameById.get(v.pincodeTypeId);
      if (name) map[name] = v.value;
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
 * Geography facts (city/state/isMetro/cityClass) for one pincode.
 */
async function getGeoFacts(pincodeCode) {
  try {
    const pincode = await prisma.pincode.findUnique({
      where: { code: pincodeCode },
      include: {
        state: { select: { name: true, code: true } },
        area: {
          include: {
            city: { select: { name: true, isMetro: true, cityClass: true } },
          },
        },
      },
    });
    if (!pincode) return {};
    return {
      city: pincode.area?.city?.name || pincode.district || null,
      state: pincode.state?.name || null,
      isMetro: pincode.area?.city?.isMetro ?? false,
      cityClass: pincode.area?.city?.cityClass || null,
    };
  } catch (error) {
    logger.debug("Error getting geo facts", {
      pincodeCode,
      error: error.message,
    });
    return {};
  }
}

async function resolveOutletBadge({ outletId, userContext }) {
  try {
    const outletContextService = getOutletContextService();
    if (outletId) {
      const outletData =
        await outletContextService.resolveOutletBadgeById(outletId);
      return outletData?.badge || null;
    }
    if (userContext?.role === "outlet" && userContext.userId) {
      const outletData = await outletContextService.resolveOutletBadge(
        userContext.userId,
      );
      return outletData?.badge || null;
    }
  } catch (error) {
    logger.warn("Failed to resolve outlet badge, continuing without discount", {
      error: error.message,
    });
  }
  return null;
}

// ==========================================
// SERVICEABILITY
// ==========================================

async function checkServiceability(params) {
  const { fromPincode, toPincode, partnerId } = params;
  logger.info("Checking serviceability (v3)", {
    fromPincode,
    toPincode,
    partnerId,
  });

  const distanceZoneService = getDistanceZoneService();

  const partnerWhere = { isActive: true };
  if (partnerId) partnerWhere.id = partnerId;

  const partners = await prisma.partner.findMany({
    where: partnerWhere,
    select: {
      id: true,
      name: true,
      displayName: true,
      defaultDeliveryDays: true,
    },
  });

  const results = await Promise.all(
    partners.map(async (partner) => {
      const label = partner.displayName || partner.name;
      try {
        const [pickupAssigned, deliveryAssigned] = await Promise.all([
          hasPincodeAssignment(partner.id, fromPincode),
          hasPincodeAssignment(partner.id, toPincode),
        ]);
        if (!pickupAssigned) {
          return {
            partnerId: partner.id,
            partnerName: label,
            serviceable: false,
            reason: "Pickup pincode not assigned to this partner",
          };
        }
        if (!deliveryAssigned) {
          return {
            partnerId: partner.id,
            partnerName: label,
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
            partnerName: label,
            serviceable: false,
            reason: "Pickup pincode has no active zone coverage",
          };
        }
        if (!deliveryCovered) {
          return {
            partnerId: partner.id,
            partnerName: label,
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
          partnerName: label,
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
          partnerName: label,
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

// ==========================================
// RATE CALCULATION
// ==========================================

async function calculateRates(params) {
  const {
    fromPincode,
    toPincode,
    weight,
    dimensions,
    numberOfBoxes = 1,
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
    shipmentDirection = "FORWARD",
    serviceType = null,
    vasSelections = [],
  } = params;

  logger.info("Calculating rates (engine v3)", {
    fromPincode,
    toPincode,
    weight,
    paymentType,
    partnerId,
    outletId,
    vasCount: vasSelections.length,
  });

  const outletBadge = await resolveOutletBadge({ outletId, userContext });
  const configRevision = await getConfigRevision();

  const cacheKey = generateCacheKey(
    {
      fromPincode,
      toPincode,
      weight,
      paymentType,
      codAmount,
      declaredValue,
      dimensions,
      numberOfBoxes,
      partnerId,
      sortBy,
      isFragile,
      shipmentType,
      shipmentDirection,
      vasSelections,
    },
    configRevision,
  );

  const redis = getRedisClient();
  const skipCache = !!outletBadge;

  if (redis && !partnerId && !skipCache) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug("Returning cached v3 quote", { cacheKey });
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn("Cache read error", { error: error.message });
    }
  }

  const distanceZoneService = getDistanceZoneService();
  const partnerChargeConfigService = getPartnerChargeConfigService();

  // System-default volumetric weight; recomputed per channel below
  let effectiveWeight = weight;
  if (dimensions?.length && dimensions?.width && dimensions?.height) {
    const volumetricWeight = weightCalc.computeVolumetric({
      boxes: numberOfBoxes,
      length: dimensions.length,
      width: dimensions.width,
      height: dimensions.height,
    });
    effectiveWeight = weightCalc.computeChargeable(weight, volumetricWeight);
  }

  // Pincode-type id -> canonical name map (small table, one read per request)
  const pincodeTypes = await prisma.pincodeType.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const typeNameById = new Map(
    pincodeTypes.map((t) => [t.id, canonicalTypeName(t.name)]),
  );

  // Shared per-request geography facts
  const [pickupGeo, deliveryGeo] = await Promise.all([
    getGeoFacts(fromPincode),
    getGeoFacts(toPincode),
  ]);

  const partnerWhere = { isActive: true };
  if (partnerId) partnerWhere.id = partnerId;

  const partners = await prisma.partner.findMany({
    where: partnerWhere,
    select: {
      id: true,
      name: true,
      displayName: true,
      defaultDeliveryDays: true,
    },
  });

  const rates = await Promise.all(
    partners.map(async (partner) => {
      const label = partner.displayName || partner.name;
      try {
        // Serviceability gates (skipped on rerates of booked shipments)
        if (!skipServiceabilityCheck) {
          const [pickupAssigned, deliveryAssigned] = await Promise.all([
            hasPincodeAssignment(partner.id, fromPincode),
            hasPincodeAssignment(partner.id, toPincode),
          ]);
          if (!pickupAssigned) {
            return {
              partnerId: partner.id,
              partnerName: label,
              serviceable: false,
              reason: "Pickup pincode not assigned to this partner",
            };
          }
          if (!deliveryAssigned) {
            return {
              partnerId: partner.id,
              partnerName: label,
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
              partnerName: label,
              serviceable: false,
              reason: "Pickup pincode has no active zone coverage",
            };
          }
          if (!deliveryCovered) {
            return {
              partnerId: partner.id,
              partnerName: label,
              serviceable: false,
              reason: "Delivery pincode has no active zone coverage",
            };
          }
        }

        // Rule-based channel eligibility (B2B/B2C + weight + amount + payment)
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
            partnerName: label,
            serviceable: false,
            reason:
              "No channel matches shipment profile (type/weight/amount/payment)",
          };
        }

        const matchedChannel =
          channelSelection.mode === "MATCHED" ? channelSelection.channel : null;

        // Channel-specific volumetric formula
        const volumetricConfig = weightCalc.resolveVolumetricConfig({
          divisor: matchedChannel?.channelConfig?.volumetricDivisor,
          factor: matchedChannel?.channelConfig?.volumetricFactor,
        });

        let partnerEffectiveWeight = effectiveWeight;
        if (dimensions?.length && dimensions?.width && dimensions?.height) {
          const channelVolumetricWeight = weightCalc.computeVolumetric({
            boxes: numberOfBoxes,
            length: dimensions.length,
            width: dimensions.width,
            height: dimensions.height,
            divisor: volumetricConfig.divisor,
            factor: volumetricConfig.factor,
          });
          partnerEffectiveWeight = weightCalc.computeChargeable(
            weight,
            channelVolumetricWeight,
          );
        }

        // Distance zone for MATRIX MILESTONE configs — never a hard gate;
        // partners may price purely by weight/value/zone-pair
        const zoneResult = await distanceZoneService.getZoneForShipment(
          partner.id,
          fromPincode,
          toPincode,
        );
        const distanceZoneUnmatched =
          !zoneResult.matched && !skipServiceabilityCheck;

        // Per-partner facts inputs (+ the carrier's own transit estimate, which
        // is independent of pricing and must never block it)
        const [
          pickupGeoZoneIds,
          deliveryGeoZoneIds,
          pickupPincodeTypes,
          deliveryPincodeTypes,
          carrierTat,
        ] = await Promise.all([
          getGeoZoneIds(partner.id, fromPincode),
          getGeoZoneIds(partner.id, toPincode),
          getPincodeTypeValuesByName(partner.id, fromPincode, typeNameById),
          getPincodeTypeValuesByName(partner.id, toPincode, typeNameById),
          getCarrierTat({
            channel: matchedChannel,
            fromPincode,
            toPincode,
            shipmentType,
            serviceType,
          }),
        ]);

        // Active configs (channel-specific override partner-wide)
        const configs =
          await partnerChargeConfigService.getActiveConfigsForPartner(
            partner.id,
            { channelId: matchedChannel?.id },
          );

        if (configs.length === 0) {
          return {
            partnerId: partner.id,
            partnerName: label,
            serviceable: false,
            reason: "No charge configuration for this partner",
          };
        }

        const definitionsByCode = new Map(
          configs.map((c) => [c.chargeDefinition.code, c.chargeDefinition]),
        );
        const answers = contextBuilder.buildAnswers(
          vasSelections,
          definitionsByCode,
        );

        const facts = contextBuilder.buildFacts({
          params: {
            weight,
            dimensions,
            numberOfBoxes,
            paymentType,
            codAmount,
            declaredValue,
            isFragile,
            shipmentType,
            shipmentDirection,
            serviceType,
          },
          chargeableWeight: partnerEffectiveWeight,
          zoneResult,
          pickupGeoZoneIds,
          deliveryGeoZoneIds,
          pickupSide: contextBuilder.buildSide({
            geo: pickupGeo,
            pincodeTypeValuesByName: pickupPincodeTypes,
          }),
          deliverySide: contextBuilder.buildSide({
            geo: deliveryGeo,
            pincodeTypeValuesByName: deliveryPincodeTypes,
          }),
          answers,
          outletBadge,
        });

        const engineResult = pipeline.run(configs, facts);

        // A BASE charge is collected on every parcel this partner carries. If
        // the partner has one configured but it could not be priced for this
        // lane (distance outside every milestone, zone pair with no row, or a
        // config pointing at zones that no longer exist), quoting anyway would
        // hand the customer a rate with the freight missing. Drop the partner.
        if (engineResult.missingBase.length > 0) {
          const codes = engineResult.missingBase
            .map((m) => m.chargeCode)
            .join(", ");
          logger.warn("Partner excluded from quote — BASE charge not priced", {
            partnerId: partner.id,
            fromPincode,
            toPincode,
            missingBase: engineResult.missingBase,
          });
          return {
            partnerId: partner.id,
            partnerName: label,
            serviceable: false,
            reason: `Base charge not configured for this lane (${codes})`,
          };
        }

        if (engineResult.totalCharge <= 0) {
          return {
            partnerId: partner.id,
            partnerName: label,
            serviceable: false,
            reason: distanceZoneUnmatched
              ? "No matching distance zone and no applicable non-distance charge configs"
              : "Charge configuration produced a zero rate",
          };
        }

        if (distanceZoneUnmatched) {
          logger.info(
            "Quoted partner without distance-zone match (non-distance configs produced a rate)",
            {
              partnerId: partner.id,
              fromPincode,
              toPincode,
              totalRate: engineResult.totalCharge,
            },
          );
        }

        // Booking questions relevant to this partner (configured + active)
        const requiredQuestions = configs
          .filter(
            (c) =>
              c.chargeDefinition.applyStage === "BOOKING_OPTION" &&
              c.chargeDefinition.bookingQuestion,
          )
          .map((c) => ({
            chargeCode: c.chargeDefinition.code,
            name: c.chargeDefinition.name,
            question: c.chargeDefinition.bookingQuestion,
          }));

        // Badge discount surfaced in the legacy `discount` field shape when present
        const discountLine = engineResult.breakdown.find(
          (l) => l.chargeCode === "BADGE_DISCOUNT",
        );
        const discountInfo = discountLine
          ? {
              badge: outletBadge,
              originalTotal:
                engineResult.totalCharge + engineResult.pricing.discount,
              totalDiscount: engineResult.pricing.discount,
              finalTotal: engineResult.totalCharge,
            }
          : null;

        return {
          partnerId: partner.id,
          partnerName: label,
          serviceable: true,
          distanceKm: zoneResult.distanceKm,
          zoneSuffix: zoneResult.zoneSuffix,
          zoneName: zoneResult.zone?.name,
          // Live carrier TAT when the aggregator exposes one, otherwise the
          // partner's configured default.
          estimatedDays: carrierTat?.days ?? partner.defaultDeliveryDays,
          estimatedDeliveryDate: carrierTat?.expectedDeliveryDate || null,
          tatSource:
            carrierTat?.source ||
            (partner.defaultDeliveryDays ? "PARTNER_DEFAULT" : null),
          chargesBreakdown: engineResult.breakdown,
          rulesEvaluated: engineResult.rulesEvaluated,
          categoriesMatched: engineResult.categoriesMatched,
          totalRate: engineResult.totalCharge, // GST-inclusive in v3
          baseRate: engineResult.pricing.preTaxTotal,
          breakdown: engineResult.breakdown,
          pricing: engineResult.pricing,
          requiredQuestions,
          volumetricDivisor: volumetricConfig.divisor,
          volumetricFactor: volumetricConfig.factor,
          chargeableWeight: partnerEffectiveWeight,
          engine: { version: "v3", configRevision },
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
          partnerName: label,
          serviceable: false,
          error: error.message,
        };
      }
    }),
  );

  const serviceableRates = rates.filter((r) => r.serviceable && !r.error);

  const sortedRates = [...serviceableRates].sort((a, b) =>
    sortBy === "highest"
      ? b.totalRate - a.totalRate
      : a.totalRate - b.totalRate,
  );

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
    allRates: rates,
    cheapestRate,
    fastestRate,
    summary: {
      totalPartners: rates.length,
      serviceablePartners: serviceableRates.length,
      sortedBy: sortBy,
    },
    engine: { version: "v3", configRevision },
    timestamp: new Date().toISOString(),
  };

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
 * Clear v3 quote cache.
 */
async function clearCache(pattern = null) {
  try {
    const redis = getRedisClient();
    if (!redis) return { cleared: 0 };

    const searchPattern = pattern
      ? `${CACHE_PREFIX}:${pattern}*`
      : `${CACHE_PREFIX}:*`;
    const keys = await redis.keys(searchPattern);
    if (keys.length > 0) await redis.del(...keys);

    logger.info("v3 quote cache cleared", {
      pattern,
      keysCleared: keys.length,
    });
    return { cleared: keys.length };
  } catch (error) {
    logger.error("Error clearing v3 quote cache", { error: error.message });
    throw error;
  }
}

module.exports = {
  calculateRates,
  checkServiceability,
  clearCache,
  // exported for eventChargeService / tests
  getGeoFacts,
  getPincodeTypeValuesByName,
};
