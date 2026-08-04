/**
 * Quote Controller (Charges Engine v3)
 *
 * HTTP layer for v3 rate calculation and EVENT charge quoting. Business logic
 * lives in quoteService / eventChargeService.
 */

const quoteService = require("../services/quoteService");
const eventChargeService = require("../services/eventChargeService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/**
 * Map a v3 quote to the wire shape shipment-service consumes.
 * Keeps every legacy field and surfaces the v3 additions
 * (pricing, requiredQuestions, engine, chargeCode-based breakdown).
 */
function toWireRate(rate, serviceType) {
  if (!rate) return rate;
  if (!rate.serviceable) return rate;
  return {
    partnerId: rate.partnerId,
    partnerName: rate.partnerName,
    serviceable: rate.serviceable,
    rate: rate.baseRate,
    totalRate: rate.totalRate,
    totalAmount: rate.totalRate,
    deliveryDays: rate.estimatedDays,
    estimatedDays: rate.estimatedDays,
    distanceKm: rate.distanceKm,
    zoneSuffix: rate.zoneSuffix,
    zoneName: rate.zoneName,
    breakdown: rate.breakdown,
    pricing: rate.pricing,
    requiredQuestions: rate.requiredQuestions,
    engine: rate.engine,
    volumetricDivisor: rate.volumetricDivisor,
    volumetricFactor: rate.volumetricFactor,
    chargeableWeight: rate.chargeableWeight,
    ...(rate.discount && { discount: rate.discount }),
    ...(rate.channel && { channel: rate.channel }),
    serviceType: serviceType || "standard",
    isServiceable: rate.serviceable,
  };
}

/**
 * POST /api/partners/calculate (v3) — also served as /calculate-v3 during
 * the migration window.
 */
async function calculateRates(req, res, next) {
  try {
    const params = req.body;
    const userContext = req.user
      ? { userId: req.user.userId || req.user.id, role: req.user.role }
      : null;

    // paymentMode (legacy alias) → paymentType
    const paymentType =
      params.paymentType?.toUpperCase() ||
      params.paymentMode?.toUpperCase() ||
      (params.codAmount && params.codAmount > 0 ? "COD" : "PREPAID");

    const result = await quoteService.calculateRates({
      fromPincode: params.fromPincode,
      toPincode: params.toPincode,
      weight: parseFloat(params.weight),
      dimensions: params.dimensions,
      numberOfBoxes: parseInt(params.numberOfBoxes, 10) || 1,
      paymentType,
      codAmount: params.codAmount ? parseFloat(params.codAmount) : 0,
      declaredValue:
        parseFloat(params.declaredValue || params.shipmentValue) || 0,
      isFragile: params.isFragile || false,
      outletId: params.outletId || null,
      partnerId: params.partnerId,
      sortBy: params.sortBy || "cheapest",
      userContext,
      skipServiceabilityCheck: params.skipServiceabilityCheck || false,
      shipmentType: params.shipmentType || "B2C",
      shipmentDirection: params.shipmentDirection || "FORWARD",
      vasSelections: params.vasSelections || [],
    });

    const rates = result.rates.map((r) => toWireRate(r, params.serviceType));

    logger.info("v3 quote calculation successful", {
      fromPincode: params.fromPincode,
      toPincode: params.toPincode,
      ratesCount: rates.length,
      cheapestRate: result.cheapestRate?.totalRate,
    });

    res.json(
      APIResponse.success({
        rates,
        allRates: result.allRates,
        cheapestRate: toWireRate(result.cheapestRate, params.serviceType),
        fastestRate: toWireRate(result.fastestRate, params.serviceType),
        summary: result.summary,
        engine: result.engine,
      }),
    );
  } catch (error) {
    logger.error("Error calculating v3 rates:", error);
    next(error);
  }
}

/**
 * POST /api/partners/event-charge-quote
 */
async function eventChargeQuote(req, res, next) {
  try {
    const { partnerId, chargeCode, eventParams, shipmentContext } = req.body;

    const quote = await eventChargeService.quoteEventCharge({
      partnerId,
      chargeCode,
      eventParams,
      shipmentContext,
    });

    res.json(APIResponse.success({ quote }));
  } catch (error) {
    logger.error("Error quoting event charge:", error);
    next(error);
  }
}

module.exports = { calculateRates, eventChargeQuote, toWireRate };
