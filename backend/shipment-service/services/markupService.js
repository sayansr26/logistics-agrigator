/**
 * Markup Service (Charges Engine v3)
 *
 * Single source of truth for resolving the outlet markup that gets priced
 * INSIDE the taxable subtotal by partner-service.
 *
 * Resolution order (first hit wins):
 *   1. the markup explicitly sent with the request
 *   2. the outlet's own stored default (defaultMarkupType/defaultMarkupValue)
 *   3. the platform-wide fallback (PLATFORM_DEFAULT_MARKUP_TYPE/_VALUE)
 *
 * Whatever is resolved is cap-checked against the outlet's admin-set limits,
 * so a client cannot widen its own margin by posting a bigger number — and,
 * because the markup is part of the signed quote total, it cannot be changed
 * between quoting and booking either.
 */

const { ValidationError } = require("../shared/lib/errors");
const logger = require("../shared/lib/logger");

const VALID_TYPES = new Set(["FLAT", "PERCENTAGE"]);

/**
 * Platform-wide fallback used when an outlet has no default of its own.
 * Returns null when unset or misconfigured (never throws — a bad env var must
 * not take quoting down).
 */
function getPlatformDefaultMarkup() {
  const type = (process.env.PLATFORM_DEFAULT_MARKUP_TYPE || "").toUpperCase();
  const value = Number(process.env.PLATFORM_DEFAULT_MARKUP_VALUE);

  if (!type) return null;
  if (!VALID_TYPES.has(type) || !Number.isFinite(value) || value <= 0) {
    logger.warn("Invalid platform default markup config — ignoring", {
      PLATFORM_DEFAULT_MARKUP_TYPE: process.env.PLATFORM_DEFAULT_MARKUP_TYPE,
      PLATFORM_DEFAULT_MARKUP_VALUE: process.env.PLATFORM_DEFAULT_MARKUP_VALUE,
    });
    return null;
  }
  return { type, value, source: "PLATFORM_DEFAULT" };
}

/**
 * Resolve the markup to price this shipment with.
 *
 * @param {Object} input
 * @param {?{type: string, value: number}} input.requested - markup from the request body
 * @param {?Object} input.outletContext - resolved outlet (defaults + caps)
 * @returns {?{type: string, value: number, source: string}} null when no markup applies
 */
function resolveEffectiveMarkup({ requested = null, outletContext = null }) {
  let markup = null;

  if (requested && requested.type && Number(requested.value) > 0) {
    markup = {
      type: String(requested.type).toUpperCase(),
      value: Number(requested.value),
      source: "REQUEST",
    };
  } else if (
    outletContext?.defaultMarkupType &&
    outletContext?.defaultMarkupValue !== null &&
    outletContext?.defaultMarkupValue !== undefined
  ) {
    markup = {
      type: String(outletContext.defaultMarkupType).toUpperCase(),
      value: Number(outletContext.defaultMarkupValue),
      source: "OUTLET_DEFAULT",
    };
  } else {
    markup = getPlatformDefaultMarkup();
  }

  if (!markup) return null;
  if (!VALID_TYPES.has(markup.type) || !(markup.value > 0)) return null;

  assertWithinCaps(markup, outletContext);
  return markup;
}

/**
 * Enforce the outlet's admin-set caps. No outlet context means no caps to
 * check (external/admin bookings without an outlet); null caps are unlimited.
 */
function assertWithinCaps(markup, outletContext) {
  if (!outletContext) return;

  if (
    markup.type === "FLAT" &&
    outletContext.maxMarkupFlat !== null &&
    outletContext.maxMarkupFlat !== undefined &&
    markup.value > Number(outletContext.maxMarkupFlat)
  ) {
    throw new ValidationError(
      `Markup exceeds the allowed flat cap of ₹${outletContext.maxMarkupFlat}`,
    );
  }

  if (
    markup.type === "PERCENTAGE" &&
    outletContext.maxMarkupPercent !== null &&
    outletContext.maxMarkupPercent !== undefined &&
    markup.value > Number(outletContext.maxMarkupPercent)
  ) {
    throw new ValidationError(
      `Markup exceeds the allowed percentage cap of ${outletContext.maxMarkupPercent}%`,
    );
  }
}

/**
 * Shape sent to partner-service /calculate (no `source` field).
 */
function toQuoteParam(markup) {
  return markup ? { type: markup.type, value: markup.value } : null;
}

module.exports = {
  resolveEffectiveMarkup,
  assertWithinCaps,
  getPlatformDefaultMarkup,
  toQuoteParam,
};
