/**
 * Weight & Cost/Profit Calculation Utilities
 *
 * Single source of truth for volumetric / chargeable weight and the
 * selling / courier / profit-margin split used across shipment-service,
 * partner-service and wallet-service.
 *
 * Volumetric formula: ((numberOfBoxes * L * W * H) / divisor) * factor
 *                     (defaults: divisor 27000, factor 6)
 * Chargeable weight : max(actualWeight, volumetricWeight)
 * Profit margin      : sellingCharge - courierCost
 *
 * All returned numbers are rounded to the given precision (default: weights 3dp,
 * money 2dp) to match the Prisma column scales (Decimal(8,3) weights,
 * Decimal(10,2)/Decimal(15,2) money).
 *
 * @module shared/utils/weightCalc
 */

const DEFAULT_VOLUMETRIC_DIVISOR = 27000;
const DEFAULT_VOLUMETRIC_FACTOR = 6;

/**
 * Round to N decimal places (avoids float drift).
 * @param {number} n
 * @param {number} [dp=2]
 * @returns {number}
 */
function round(n, dp = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 0;
  const f = Math.pow(10, dp);
  return Math.round(Number(n) * f) / f;
}

/**
 * Resolve the volumetric divisor/factor pair, falling back to the system
 * defaults. This is the single place the "use default" (null) fallback is
 * expressed: a channel stores NULL for either field to opt into the default.
 * @param {Object} [p]
 * @param {number|null} [p.divisor]
 * @param {number|null} [p.factor]
 * @returns {{ divisor: number, factor: number }}
 */
function resolveVolumetricConfig({ divisor, factor } = {}) {
  return {
    divisor: Number(divisor) > 0 ? Number(divisor) : DEFAULT_VOLUMETRIC_DIVISOR,
    factor: Number(factor) > 0 ? Number(factor) : DEFAULT_VOLUMETRIC_FACTOR,
  };
}

/**
 * Compute volumetric weight for a package.
 * @param {Object} p
 * @param {number} [p.boxes=1] - number of boxes
 * @param {number} p.length - cm
 * @param {number} p.width - cm
 * @param {number} p.height - cm
 * @param {number} [p.divisor=27000] - volumetric divisor
 * @param {number} [p.factor=6] - volumetric factor
 * @returns {number} volumetric weight in kg (3dp)
 */
function computeVolumetric({
  boxes = 1,
  length,
  width,
  height,
  divisor,
  factor,
} = {}) {
  const b = Number(boxes) || 1;
  const l = Number(length) || 0;
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const cfg = resolveVolumetricConfig({ divisor, factor });
  if (l <= 0 || w <= 0 || h <= 0) return 0;
  return round(((b * l * w * h) / cfg.divisor) * cfg.factor, 3);
}

/**
 * Chargeable weight = higher of actual and volumetric.
 * @param {number} actualWeight - kg
 * @param {number} volumetricWeight - kg
 * @returns {number} chargeable weight in kg (3dp)
 */
function computeChargeable(actualWeight, volumetricWeight) {
  const actual = Number(actualWeight) || 0;
  const vol = Number(volumetricWeight) || 0;
  return round(Math.max(actual, vol), 3);
}

/**
 * Convenience: compute volumetric + chargeable in one call.
 * @param {Object} p - { boxes, weight, length, width, height, divisor, factor }
 * @returns {{ volumetricWeight: number, chargeableWeight: number, divisor: number, factor: number }}
 */
function computeWeights({
  boxes = 1,
  weight,
  length,
  width,
  height,
  divisor,
  factor,
} = {}) {
  const cfg = resolveVolumetricConfig({ divisor, factor });
  const volumetricWeight = computeVolumetric({
    boxes,
    length,
    width,
    height,
    divisor: cfg.divisor,
    factor: cfg.factor,
  });
  const chargeableWeight = computeChargeable(weight, volumetricWeight);
  return {
    volumetricWeight,
    chargeableWeight,
    divisor: cfg.divisor,
    factor: cfg.factor,
  };
}

/**
 * Profit margin = sellingCharge - courierCost.
 * Returns null when courierCost is unknown (null/undefined) so callers can
 * distinguish "no margin" (0) from "cost not captured yet" (null).
 * @param {number} sellingCharge
 * @param {number|null|undefined} courierCost
 * @returns {number|null} profit margin (2dp) or null if courierCost unknown
 */
function computeProfitMargin(sellingCharge, courierCost) {
  if (courierCost === null || courierCost === undefined || courierCost === "") {
    return null;
  }
  const selling = Number(sellingCharge) || 0;
  const cost = Number(courierCost) || 0;
  return round(selling - cost, 2);
}

module.exports = {
  DEFAULT_VOLUMETRIC_DIVISOR,
  DEFAULT_VOLUMETRIC_FACTOR,
  round,
  resolveVolumetricConfig,
  computeVolumetric,
  computeChargeable,
  computeWeights,
  computeProfitMargin,
};
