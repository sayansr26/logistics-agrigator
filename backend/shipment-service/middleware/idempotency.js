/**
 * Idempotency for External API mutations.
 *
 * Why this exists (and why it reserves BEFORE the controller runs):
 * `createShipment` debits the wallet before it inserts the shipment row, and
 * its catch block does not refund. So two identical in-flight requests — an
 * MCP tool retry, a client timeout retry — could both debit, with the second
 * insert failing on a unique constraint AFTER the money moved. Reserving a row
 * here commits before any side effect, so the second request is turned away
 * (or replayed) rather than paying twice.
 *
 * Protocol:
 *   first request         -> reserve (status "in_progress"), run, store result
 *   repeat, completed     -> replay the stored response, Idempotency-Replayed: true
 *   repeat, in progress   -> 409 idempotency_key_in_progress
 *   same key, other body  -> 422 idempotency_key_reuse
 *   handler errored       -> reservation deleted, so a real retry can proceed
 */

const crypto = require("crypto");

const logger = require("../shared/lib/logger");
const { prisma } = require("../config/database");
const { sendExternalError } = require("./externalEnvelope");

const RECORD_TTL_HOURS = 24;

/**
 * Stable JSON: object keys sorted recursively so that two logically identical
 * bodies hash the same regardless of property order.
 */
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function hashBody(body) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(body ?? {})))
    .digest("hex");
}

/**
 * @param {Object} [options]
 * @param {boolean} [options.required=false] - Reject the request when the
 *   Idempotency-Key header is absent. Even when false, a key is derived from
 *   the credential + orderId so a naive client that retries the same order is
 *   still protected.
 */
function idempotency(options = {}) {
  const { required = false } = options;

  return async (req, res, next) => {
    const credentialId = req.user?.apiCredentialId;
    if (!credentialId) return next();

    let key = req.get("Idempotency-Key");

    if (!key) {
      if (required && !req.body?.orderId) {
        return sendExternalError(
          res,
          400,
          "invalid_request_error",
          "idempotency_key_required",
          "An Idempotency-Key header is required for this operation.",
        );
      }
      // Derived fallback: the same order booked twice is the same intent.
      key = `auto_${crypto
        .createHash("sha256")
        .update(`${credentialId}:${req.body?.orderId || ""}`)
        .digest("hex")
        .slice(0, 40)}`;
    }

    if (key.length > 255) {
      return sendExternalError(
        res,
        400,
        "invalid_request_error",
        "idempotency_key_invalid",
        "Idempotency-Key must be 255 characters or fewer.",
      );
    }

    const requestHash = hashBody(req.body);
    const expiresAt = new Date(Date.now() + RECORD_TTL_HOURS * 3600 * 1000);

    let record;
    try {
      record = await prisma.idempotencyRecord.create({
        data: {
          key,
          credentialId,
          requestHash,
          status: "in_progress",
          expiresAt,
        },
      });
    } catch (error) {
      if (error.code !== "P2002") return next(error);

      // Key already seen for this credential.
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { credentialId_key: { credentialId, key } },
      });

      if (!existing) return next(error);

      if (existing.requestHash !== requestHash) {
        return sendExternalError(
          res,
          422,
          "invalid_request_error",
          "idempotency_key_reuse",
          "This Idempotency-Key was already used with a different request body.",
        );
      }

      if (existing.status === "completed") {
        logger.info("Replaying idempotent response", {
          service: "shipment-service",
          credentialId,
          key,
          shipmentId: existing.shipmentId,
        });
        res.set("Idempotency-Replayed", "true");
        return res
          .status(existing.responseStatus || 200)
          .json(existing.responseBody);
      }

      return sendExternalError(
        res,
        409,
        "invalid_request_error",
        "idempotency_key_in_progress",
        "A request with this Idempotency-Key is still being processed. Retry shortly.",
      );
    }

    // Capture the outcome so a later retry can replay it.
    const originalJson = res.json.bind(res);
    let settled = false;

    res.json = (body) => {
      const statusCode = res.statusCode || 200;

      // Only successful outcomes are worth replaying; caching a 5xx would
      // make a transient failure permanent for that key.
      if (statusCode >= 200 && statusCode < 300) {
        settled = true;
        prisma.idempotencyRecord
          .update({
            where: { id: record.id },
            data: {
              status: "completed",
              responseStatus: statusCode,
              responseBody: body,
              shipmentId: body?.data?.id || body?.data?.shipment?.id || null,
            },
          })
          .catch((error) =>
            logger.error("Failed to persist idempotency result", {
              service: "shipment-service",
              key,
              error: error.message,
            }),
          );
      } else {
        settled = true;
        prisma.idempotencyRecord
          .delete({ where: { id: record.id } })
          .catch(() => {});
      }

      return originalJson(body);
    };

    // If the handler throws or never responds, release the reservation so the
    // client is not locked out for 24 hours.
    res.on("finish", () => {
      if (settled) return;
      prisma.idempotencyRecord
        .delete({ where: { id: record.id } })
        .catch(() => {});
    });

    return next();
  };
}

module.exports = { idempotency, hashBody };
