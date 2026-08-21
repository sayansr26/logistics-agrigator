/**
 * External API response envelope.
 *
 * The internal `APIResponse` shape is not fit to be a public contract: it puts
 * `statusCode` inside the body and its error codes are ad hoc
 * ("SHIPMENT_CREATION_FAILED", "QUOTE_FETCH_FAILED", "AWB_TRACKING_FAILED").
 * This middleware intercepts `res.json` so the existing controllers can be
 * reused verbatim while callers see one stable envelope:
 *
 *   { "success": true,  "data": {...}, "meta": {...}, "request_id": "req_..." }
 *   { "success": false, "error": { "type", "code", "message", "param"? },
 *     "request_id": "req_..." }
 */

const crypto = require("crypto");

const CURRENT_API_VERSION = "2026-08-21";

/**
 * Internal error code -> { type, code } in the external taxonomy.
 * Anything unmapped falls back to a status-derived type and a snake_cased code.
 */
const ERROR_MAP = {
  VALIDATION_ERROR: ["invalid_request_error", "validation_failed"],
  UNAUTHORIZED: ["authentication_error", "unauthorized"],
  TOKEN_EXPIRED: ["authentication_error", "token_expired"],
  INVALID_TOKEN: ["authentication_error", "invalid_token"],
  CREDENTIAL_REVOKED: ["authentication_error", "credential_revoked"],
  FORBIDDEN: ["permission_error", "insufficient_scope"],
  NOT_FOUND: ["invalid_request_error", "shipment_not_found"],
  QUOTE_STALE: ["invalid_request_error", "quote_stale"],
  INSUFFICIENT_BALANCE: [
    "invalid_request_error",
    "insufficient_wallet_balance",
  ],
  CONFLICT: ["invalid_request_error", "conflict"],
  SERVICE_UNAVAILABLE: ["service_unavailable_error", "service_unavailable"],
  RATE_LIMIT_EXCEEDED: ["rate_limit_error", "rate_limit_exceeded"],
};

/** Derive an error type from the HTTP status when the code is unmapped. */
function typeForStatus(status) {
  if (status === 401) return "authentication_error";
  if (status === 403) return "permission_error";
  if (status === 429) return "rate_limit_error";
  if (status === 503) return "service_unavailable_error";
  if (status >= 500) return "api_error";
  return "invalid_request_error";
}

function toSnakeCode(code) {
  return String(code || "internal_error").toLowerCase();
}

/**
 * Build the public error body for an internal error payload.
 */
function toExternalError(internalError, statusCode, requestId) {
  const code = internalError?.code;
  const [type, publicCode] = ERROR_MAP[code] || [
    typeForStatus(statusCode),
    toSnakeCode(code),
  ];

  return {
    success: false,
    error: {
      type,
      code: publicCode,
      message: internalError?.message || "Request failed",
      ...(internalError?.details ? { details: internalError.details } : {}),
    },
    request_id: requestId,
  };
}

/**
 * Attach a request id, resolve the API version, and rewrite every response
 * body into the external envelope.
 */
function externalEnvelope(req, res, next) {
  const requestId = `req_${crypto.randomBytes(12).toString("hex")}`;
  res.locals.requestId = requestId;
  res.set("X-Request-Id", requestId);

  // Dated version: explicit header > the credential's pinned version > current.
  const requestedVersion =
    req.get("LGK-Version") || req.user?.apiVersion || CURRENT_API_VERSION;
  res.locals.apiVersion = requestedVersion;
  res.set("LGK-Version", requestedVersion);

  const originalJson = res.json.bind(res);

  res.json = (body) => {
    // Already in external shape (e.g. emitted by this layer itself).
    if (body && typeof body === "object" && "success" in body) {
      if (!body.request_id) body.request_id = requestId;
      return originalJson(body);
    }

    if (body && body.status === "error") {
      const status =
        res.statusCode >= 400 ? res.statusCode : body.statusCode || 500;
      res.status(status);
      return originalJson(toExternalError(body.error, status, requestId));
    }

    if (body && body.status === "success") {
      const { pagination, ...restMeta } = body.meta || {};
      return originalJson({
        success: true,
        data: body.data,
        ...(pagination ? { meta: { pagination } } : {}),
        ...(restMeta.message ? { message: restMeta.message } : {}),
        request_id: requestId,
      });
    }

    return originalJson(body);
  };

  next();
}

/**
 * Terminal error handler for the External API. Registered after the routes so
 * a thrown error never escapes as the internal envelope or a stack trace.
 */
// eslint-disable-next-line no-unused-vars
function externalErrorHandler(err, req, res, next) {
  const logger = require("../shared/lib/logger");
  const status = err.statusCode || err.status || 500;
  const requestId = res.locals.requestId || null;

  logger.error("External API error", {
    service: "shipment-service",
    path: req.originalUrl,
    method: req.method,
    apiCredentialId: req.user?.apiCredentialId,
    status,
    error: err.message,
  });

  if (res.headersSent) return;

  res.status(status).json(
    toExternalError(
      {
        code: err.code || (status >= 500 ? "internal_error" : "bad_request"),
        message:
          status >= 500
            ? "An unexpected error occurred. Please retry or contact support with the request id."
            : err.message,
        details: err.details || null,
      },
      status,
      requestId,
    ),
  );
}

/**
 * Send an external error directly (used by middleware before a controller runs).
 */
function sendExternalError(res, statusCode, type, code, message, details) {
  return res.status(statusCode).json({
    success: false,
    error: {
      type,
      code,
      message,
      ...(details ? { details } : {}),
    },
    request_id: res.locals.requestId || null,
  });
}

module.exports = {
  externalEnvelope,
  externalErrorHandler,
  sendExternalError,
  CURRENT_API_VERSION,
};
