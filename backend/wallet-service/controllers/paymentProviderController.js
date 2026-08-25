/**
 * Payment Provider Controller
 *
 * THIN BY MANDATE: every rule (credential merge semantics, the enabling guard,
 * the mode-switch guard, audit logging, caching) lives in
 * `services/payments/providerConfigService.js`. These handlers only translate
 * HTTP <-> service call.
 *
 * A response from this controller NEVER contains a decrypted credential — the
 * service returns masked views (`keySecretMasked`) and nothing else.
 */

const providerConfigService = require("../services/payments/providerConfigService");
const APIResponse = require("../shared/lib/response");
const logger = require("../shared/lib/logger");

/** Audit context for every write. */
function requestMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  };
}

function fail(res, error, fallbackMessage) {
  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_ERROR";

  if (statusCode >= 500) {
    logger.error(fallbackMessage, { error: error.message, stack: error.stack });
  } else {
    logger.warn(fallbackMessage, { error: error.message, code });
  }

  return res
    .status(statusCode)
    .json(
      APIResponse.error(
        error.message || fallbackMessage,
        code,
        error.details || null,
        statusCode,
      ),
    );
}

/**
 * GET /api/v1/wallet/payment-providers
 * Masked configuration for every provider, including "coming soon" entries.
 */
async function listProviders(req, res) {
  try {
    const providers = await providerConfigService.listConfigs();

    return res.json(
      APIResponse.success(
        providers,
        "Payment providers retrieved successfully",
      ),
    );
  } catch (error) {
    return fail(res, error, "Failed to list payment providers");
  }
}

/**
 * GET /api/v1/wallet/payment-providers/:provider
 * Masked configuration for one provider.
 */
async function getProvider(req, res) {
  try {
    const config = await providerConfigService.getConfigSafe(
      req.params.provider,
    );

    return res.json(
      APIResponse.success(
        config,
        "Payment provider configuration retrieved successfully",
      ),
    );
  } catch (error) {
    return fail(res, error, "Failed to get payment provider configuration");
  }
}

/**
 * PUT /api/v1/wallet/payment-providers/:provider
 * Update credentials / limits / mode. Empty-string fields CLEAR a secret,
 * omitted fields leave it untouched.
 */
async function updateProvider(req, res) {
  try {
    const config = await providerConfigService.updateConfig(
      req.params.provider,
      req.body,
      req.user,
      requestMeta(req),
    );

    return res.json(
      APIResponse.success(
        config,
        "Payment provider configuration updated successfully",
      ),
    );
  } catch (error) {
    return fail(res, error, "Failed to update payment provider configuration");
  }
}

/**
 * POST /api/v1/wallet/payment-providers/:provider/test-connection
 * Verifies the STORED credentials against the gateway. The body may carry a
 * `mode` only — a secret is never accepted here (see the service for why).
 */
async function testConnection(req, res) {
  try {
    const result = await providerConfigService.testConnection(
      req.params.provider,
      req.body?.mode,
      req.user,
      requestMeta(req),
    );

    return res.json(
      APIResponse.success(
        result,
        result.ok ? "Connection successful" : "Connection failed",
      ),
    );
  } catch (error) {
    return fail(res, error, "Failed to test payment provider connection");
  }
}

/**
 * GET /api/v1/wallet/payment-providers/policy
 * Manual (offline) top-up policy limits.
 */
async function getPolicy(req, res) {
  try {
    const policy = await providerConfigService.getTopupPolicy();

    return res.json(
      APIResponse.success(policy, "Top-up policy retrieved successfully"),
    );
  } catch (error) {
    return fail(res, error, "Failed to get top-up policy");
  }
}

/**
 * PUT /api/v1/wallet/payment-providers/policy
 */
async function updatePolicy(req, res) {
  try {
    const policy = await providerConfigService.updateTopupPolicy(
      req.body,
      req.user,
      requestMeta(req),
    );

    return res.json(
      APIResponse.success(policy, "Top-up policy updated successfully"),
    );
  } catch (error) {
    return fail(res, error, "Failed to update top-up policy");
  }
}

/**
 * GET /api/v1/wallet/payment-providers/active
 * Customer-facing, non-secret. Returns `{ enabled: false, provider: null }`
 * with HTTP 200 when no gateway is usable so the UI hides Add Money.
 */
async function getActiveProvider(req, res) {
  try {
    const active = await providerConfigService.getActiveProviderPublic();

    return res.json(
      APIResponse.success(active, "Active payment provider retrieved"),
    );
  } catch (error) {
    return fail(res, error, "Failed to get active payment provider");
  }
}

module.exports = {
  listProviders,
  getProvider,
  updateProvider,
  testConnection,
  getPolicy,
  updatePolicy,
  getActiveProvider,
};
