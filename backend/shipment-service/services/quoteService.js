/**
 * Quote Service
 *
 * Builds signed partner quotes for a shipment request.
 *
 * This logic was previously inline in `shipmentController.getShipmentQuotes`.
 * It is extracted here so both the internal `POST /api/v1/shipments/quotes`
 * endpoint and the External API's one-step booking flow price a shipment
 * through the exact same code path — every quote is signed with the same HMAC
 * quote token that `createShipment` later verifies, so there is only ever one
 * place that mints them.
 */

const partnerIntegrationService = require("./partnerIntegrationService");
const quoteSigningService = require("./quoteSigningService");
const weightCalc = require("../shared/utils/weightCalc");

// Partner-service returns raw enum names for the base charge; map them to the
// labels the API surfaces to callers.
const BASE_LABELS = {
  WEIGHT: "Weight Charge",
  INVOICE_VALUE: "Invoice Value Charge",
  COD_VALUE: "COD Value Charge",
  ZONE_TO_ZONE_WEIGHT: "Zone-to-Zone Charge",
  DISTANCE_BASE_WEIGHT: "Distance Charge",
};

/**
 * Normalize partner-service's charge breakdown into the caller-facing shape.
 * @param {Object} rate - A single rate entry from partnerIntegrationService
 * @returns {Array<{name: string, amount: number, type: ?string, calculation: ?string}>}
 */
function normalizeBreakdown(rate) {
  const rawBreakdown =
    rate.breakdown || rate.chargesBreakdown || rate.chargeBreakdown || [];

  if (!Array.isArray(rawBreakdown)) return [];

  return rawBreakdown.map((entry) => {
    const rawName = entry.chargeTypeName || entry.base || "Charge";
    const isRawEnum = Object.keys(BASE_LABELS).includes(rawName);
    const label = isRawEnum ? BASE_LABELS[rawName] : rawName;

    return {
      name: label,
      amount: entry.totalCharge || 0,
      type: entry.base || null,
      calculation: entry.calculation || null,
    };
  });
}

/**
 * Price a shipment across all serviceable partners and sign each quote.
 *
 * @param {Object} input
 * @param {string} input.fromPincode
 * @param {string} input.toPincode
 * @param {number} input.weight - Actual weight in kg
 * @param {number} [input.numberOfBoxes=1]
 * @param {Object} input.dimensions - { length, width, height }
 * @param {string} [input.serviceType="STANDARD"]
 * @param {string} [input.paymentType="PREPAID"] - PREPAID | COD
 * @param {number} [input.codAmount]
 * @param {string} [input.shipmentType="B2C"] - B2B | B2C
 * @param {Array} [input.vasSelections=[]] - [{ chargeCode, answer }]
 * @param {number} [input.declaredValue=0]
 * @param {boolean} [input.isFragile=false]
 * @param {string} [input.outletId]
 * @param {string} [input.sortBy="cheapest"]
 * @param {string} [authToken] - Caller's Authorization header, forwarded to partner-service
 * @returns {Promise<{quotes: Array, recommended: ?Object, params: Object}>}
 */
async function buildQuotes(input, authToken) {
  const {
    fromPincode,
    toPincode,
    weight,
    numberOfBoxes = 1,
    dimensions,
    serviceType = "STANDARD",
    paymentType = "PREPAID",
    codAmount,
    shipmentType = "B2C",
    vasSelections = [],
    declaredValue = 0,
    isFragile = false,
    outletId = null,
    sortBy = "cheapest",
  } = input;

  const rateParams = {
    fromPincode,
    toPincode,
    weight,
    serviceType: String(serviceType).toUpperCase(),
    dimensions,
    numberOfBoxes,
    codAmount: paymentType === "COD" ? codAmount : null,
    declaredValue,
    paymentMode: paymentType,
    isFragile,
    outletId,
    sortBy,
    shipmentType,
    vasSelections,
  };

  // Partner quote engine already applies pincode assignment, zone coverage,
  // and pricing rules. A second serviceability pass used the stricter
  // "distance zone matched" flag and dropped partners that still had valid
  // WEIGHT / non-distance pricing — yielding empty quotes while pincodes
  // were assigned. Trust calculateRates as the single source of truth here.
  const rateData = await partnerIntegrationService.calculateRates(
    rateParams,
    authToken,
  );

  const quotes = (rateData.rates || [])
    .map((rate) => {
      // Reuse the formula partner-service priced with (channel-specific or
      // system default) rather than re-deriving one here
      const { divisor, factor } = weightCalc.resolveVolumetricConfig({
        divisor: rate.volumetricDivisor,
        factor: rate.volumetricFactor,
      });
      const volWeight = weightCalc.computeVolumetric({
        boxes: numberOfBoxes,
        length: dimensions.length,
        width: dimensions.width,
        height: dimensions.height,
        divisor,
        factor,
      });
      const chargeableWt = weightCalc.computeChargeable(weight, volWeight);

      const quote = {
        partnerId: rate.partnerId,
        partnerName: rate.partnerName,
        totalAmount: rate.totalRate || rate.totalAmount || 0,
        deliveryDays: rate.deliveryDays || rate.estimatedDays || null,
        // Carrier's own expected delivery date (Delhivery TAT API and
        // friends); null when only a day count is known.
        estimatedDeliveryDate: rate.estimatedDeliveryDate || null,
        tatSource: rate.tatSource || null,
        chargeBreakdown: normalizeBreakdown(rate),
        volumetricDivisor: divisor,
        volumetricFactor: factor,
        volumetricWeight: volWeight,
        chargeableWeight: chargeableWt,
        actualWeight: weight,
        serviceable: rate.isServiceable !== false && rate.serviceable !== false,
        // Charges Engine v3 additions (money split + dynamic VAS questions)
        ...(rate.pricing && { pricing: rate.pricing }),
        ...(rate.requiredQuestions && {
          requiredQuestions: rate.requiredQuestions,
        }),
        ...(rate.engine && { engine: rate.engine }),
        ...(rate.discount && { discount: rate.discount }),
        ...(rate.channel && { channel: rate.channel }),
      };

      // Signed token: shipment creation verifies price/params against this,
      // never against the client-editable snapshot
      if (quote.serviceable) {
        quote.quoteToken = quoteSigningService.signQuote(
          quote,
          {
            fromPincode,
            toPincode,
            weight,
            paymentType,
            codAmount,
            shipmentType,
            serviceType,
          },
          vasSelections,
        );
      }

      return quote;
    })
    .sort((a, b) => a.totalAmount - b.totalAmount);

  return {
    quotes,
    recommended: quotes[0] || null,
    params: {
      fromPincode,
      toPincode,
      weight,
      numberOfBoxes,
      dimensions,
      serviceType,
      paymentType,
      shipmentType,
    },
  };
}

module.exports = { buildQuotes };
