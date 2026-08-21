/**
 * External Shipment API adapters.
 *
 * These are deliberately THIN. `externalAuth` populates `req.user` in exactly
 * the shape the internal controllers expect, so almost every endpoint just
 * delegates and lets the envelope middleware reshape the response. Only three
 * things need real logic here:
 *
 *   1. one-step booking  — quote, pick, sign and inject before delegating
 *   2. AWB tracking      — the internal trackByAwbNumber has NO tenant scoping,
 *                          so ownership must be proven first
 *   3. flexible lookup   — external callers identify a shipment by id, AWB or
 *                          their own orderId
 */

const logger = require("../../shared/lib/logger");
const { prisma } = require("../../config/database");
const { authUtils } = require("../../shared/lib/auth");
const quoteService = require("../../services/quoteService");
const shipmentController = require("../shipmentController");
const { sendExternalError } = require("../../middleware/externalEnvelope");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve an external identifier (shipment id, AWB, or the caller's own
 * orderId) to a shipment the caller is allowed to see.
 *
 * Always goes through applyScopeFilter, so an outlet can only ever resolve its
 * own shipments and a lookup for someone else's identifier is indistinguishable
 * from one that does not exist.
 *
 * @returns {Promise<?{id: string, awbNumber: ?string}>}
 */
async function resolveShipment(req, identifier) {
  const or = [{ orderId: identifier }, { awbNumber: identifier }];
  if (UUID_PATTERN.test(identifier)) or.unshift({ id: identifier });

  const where = authUtils.applyScopeFilter(req, { OR: or });

  return prisma.shipment.findFirst({
    where,
    select: { id: true, awbNumber: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Rewrite `req.params.id` to the real shipment id, or 404.
 * Returns false when a response has already been sent.
 */
async function bindShipmentParam(req, res) {
  const shipment = await resolveShipment(req, req.params.id);

  if (!shipment) {
    sendExternalError(
      res,
      404,
      "invalid_request_error",
      "shipment_not_found",
      "No shipment matches that id, AWB number or order id.",
    );
    return false;
  }

  req.params.id = shipment.id;
  return true;
}

/**
 * Derive the quote parameters for a booking body.
 *
 * CRITICAL: these must come from the same post-coercion body fields that
 * `assertClaimsMatchPayload` compares the signed claims against
 * (pickup/delivery pincode, weight, paymentType, codAmount, shipmentType,
 * vasSelections). Recomputing them differently anywhere is how a one-step
 * booking ends up failing its own token check.
 */
function deriveQuoteParams(body, outletId) {
  return {
    fromPincode: body.pickupAddress.pincode,
    toPincode: body.deliveryAddress.pincode,
    weight: body.packageDetails.weight,
    numberOfBoxes: body.numberOfBoxes,
    dimensions: body.packageDetails.dimensions,
    serviceType: body.serviceType,
    paymentType: body.paymentType,
    codAmount: body.paymentType === "COD" ? body.codAmount : null,
    shipmentType: body.shipmentType,
    vasSelections: body.vasSelections || [],
    declaredValue: body.packageDetails.value || 0,
    isFragile: body.packageDetails.fragile || false,
    outletId: outletId || null,
    sortBy: body.selection === "fastest" ? "fastest" : "cheapest",
  };
}

/**
 * Choose a quote from the priced list.
 * `quotes` arrives sorted by totalAmount ascending.
 */
function selectQuote(quotes, { partnerId, selection }) {
  if (partnerId) {
    return quotes.find((q) => q.partnerId === partnerId) || null;
  }

  if (selection === "fastest") {
    const withDays = quotes.filter(
      (q) => q.deliveryDays !== null && q.deliveryDays !== undefined,
    );
    if (!withDays.length) return quotes[0] || null;
    // Fewest days wins; cheapest breaks the tie (the list is already sorted by
    // price, so a stable comparison on days alone is enough).
    return withDays.reduce((best, q) =>
      q.deliveryDays < best.deliveryDays ? q : best,
    );
  }

  return quotes[0] || null;
}

/**
 * POST /api/v1/external/shipments
 *
 * One-step booking: when no `quoteToken` is supplied, price the shipment
 * server-side, pick a partner, and inject the signed quote before handing off
 * to the internal `createShipment`. Because the token is seconds old here, its
 * expiry/re-quote branch never fires — a one-step booking cannot return
 * QUOTE_STALE, unlike the two-step flow.
 */
async function bookShipment(req, res, next) {
  try {
    // Platform-level credentials act for a named outlet; outlet-bound ones are
    // already the outlet, and resolveOutletContext() reads it from req.user.
    const outletId =
      req.user.role === "outlet" ? null : req.body.outletId || null;

    if (req.user.role !== "outlet" && !req.body.outletId) {
      return sendExternalError(
        res,
        400,
        "invalid_request_error",
        "outlet_required",
        "This credential is platform-level: include outletId (and outletUserId) in the request.",
      );
    }

    if (!req.body.quoteToken) {
      const params = deriveQuoteParams(req.body, outletId);

      const { quotes } = await quoteService.buildQuotes(
        params,
        req.header("Authorization"),
      );

      const bookable = quotes.filter((q) => q.serviceable && q.quoteToken);

      if (!bookable.length) {
        return sendExternalError(
          res,
          400,
          "invalid_request_error",
          "no_serviceable_partner",
          "No courier partner can service this route with the given package.",
          {
            fromPincode: params.fromPincode,
            toPincode: params.toPincode,
            quotesEvaluated: quotes.length,
          },
        );
      }

      const chosen = selectQuote(bookable, {
        partnerId: req.body.partnerId,
        selection: req.body.selection,
      });

      if (!chosen) {
        return sendExternalError(
          res,
          400,
          "invalid_request_error",
          "partner_not_serviceable",
          "The requested partner cannot service this route.",
          {
            requestedPartnerId: req.body.partnerId,
            availablePartnerIds: bookable.map((q) => q.partnerId),
          },
        );
      }

      logger.info("External one-step booking: quote selected", {
        service: "shipment-service",
        apiCredentialId: req.user.apiCredentialId,
        partnerId: chosen.partnerId,
        totalAmount: chosen.totalAmount,
        selection: req.body.selection,
      });

      req.body.selectedPartnerId = chosen.partnerId;
      req.body.quoteSnapshot = chosen;
      req.body.quoteToken = chosen.quoteToken;
    } else {
      // Two-step: the caller already holds a signed quote.
      req.body.selectedPartnerId = req.body.partnerId;
    }

    // The internal controller owns these names; `partnerId`/`selection` are
    // External-API-only sugar and must not reach it.
    delete req.body.partnerId;
    delete req.body.selection;

    return shipmentController.createShipment(req, res);
  } catch (error) {
    return next(error);
  }
}

/** GET /api/v1/external/shipments */
async function listShipments(req, res) {
  return shipmentController.getShipments(req, res);
}

/** GET /api/v1/external/shipments/:id */
async function getShipment(req, res, next) {
  try {
    if (!(await bindShipmentParam(req, res))) return undefined;
    return shipmentController.getShipmentById(req, res);
  } catch (error) {
    return next(error);
  }
}

/** PATCH /api/v1/external/shipments/:id */
async function updateShipment(req, res, next) {
  try {
    if (!(await bindShipmentParam(req, res))) return undefined;
    return shipmentController.updateShipment(req, res);
  } catch (error) {
    return next(error);
  }
}

/** POST /api/v1/external/shipments/:id/cancel */
async function cancelShipment(req, res, next) {
  try {
    if (!(await bindShipmentParam(req, res))) return undefined;
    return shipmentController.cancelShipment(req, res);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/external/shipments/rates
 * Price a prospective shipment. Every returned quote carries a `quoteToken`
 * usable for two-step booking within 15 minutes.
 */
async function getRates(req, res, next) {
  try {
    const outletId =
      req.user.role === "outlet" ? null : req.body.outletId || null;

    const { quotes, recommended, params } = await quoteService.buildQuotes(
      { ...req.body, outletId },
      req.header("Authorization"),
    );

    return res.json({
      success: true,
      data: { quotes, recommended, params },
      request_id: res.locals.requestId,
    });
  } catch (error) {
    return next(error);
  }
}

/** GET /api/v1/external/shipments/:id/tracking */
async function getTracking(req, res, next) {
  try {
    if (!(await bindShipmentParam(req, res))) return undefined;
    return shipmentController.getShipmentTracking(req, res);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/external/shipments/track/:awbNumber
 *
 * The internal `trackByAwbNumber` applies NO scope filter — it will happily
 * return tracking for any AWB in the system. Ownership is proven here first,
 * so one outlet cannot enumerate another's shipments.
 */
async function trackByAwb(req, res, next) {
  try {
    const { awbNumber } = req.params;

    const owned = await prisma.shipment.findFirst({
      where: authUtils.applyScopeFilter(req, { awbNumber }),
      select: { id: true },
    });

    if (!owned) {
      return sendExternalError(
        res,
        404,
        "invalid_request_error",
        "shipment_not_found",
        "No shipment with that AWB number was found for this account.",
      );
    }

    return shipmentController.trackByAwbNumber(req, res);
  } catch (error) {
    return next(error);
  }
}

/** POST /api/v1/external/shipments/serviceability */
async function checkServiceability(req, res) {
  return shipmentController.checkServiceability(req, res);
}

/** GET /api/v1/external/shipments/:id/documents */
async function getDocuments(req, res, next) {
  try {
    if (!(await bindShipmentParam(req, res))) return undefined;
    return shipmentController.getShipmentDocuments(req, res);
  } catch (error) {
    return next(error);
  }
}

/** POST /api/v1/external/shipments/:id/label */
async function getLabel(req, res, next) {
  try {
    if (!(await bindShipmentParam(req, res))) return undefined;
    return shipmentController.fetchCourierLabel(req, res);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  bookShipment,
  listShipments,
  getShipment,
  updateShipment,
  cancelShipment,
  getRates,
  getTracking,
  trackByAwb,
  checkServiceability,
  getDocuments,
  getLabel,
  // exported for tests
  selectQuote,
  deriveQuoteParams,
};
