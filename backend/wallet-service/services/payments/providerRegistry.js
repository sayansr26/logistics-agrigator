/**
 * Payment Provider Registry
 *
 * A tiny, dependency-free registry that decouples the payment controllers /
 * services from any single gateway SDK. Controllers only ever do:
 *
 *   const { getProvider } = require("./payments");
 *   const provider = getProvider(config.provider);
 *   const order = await provider.createOrder({ config: resolvedConfig, ... });
 *
 * CONTRACT RULE — every provider function receives a RESOLVED PLAIN CONFIG
 * OBJECT, never a raw Prisma row:
 *   { provider, mode, keyId, keySecret, webhookSecret, currency, ... }
 * The caller is responsible for decrypting secrets (utils/secretCrypto.js) and
 * picking the TEST/LIVE credential set before calling in. Providers must stay
 * stateless and must never touch the database.
 *
 * @typedef {Object} ResolvedProviderConfig
 * @property {string} provider      - "razorpay" | "stripe" | ...
 * @property {"TEST"|"LIVE"} mode
 * @property {string} keyId         - decrypted public/API key id for `mode`
 * @property {string} keySecret     - decrypted API secret for `mode`
 * @property {string} webhookSecret - decrypted webhook signing secret for `mode`
 * @property {string} currency      - ISO currency, "INR"
 *
 * @typedef {Object} PaymentProvider
 * @property {string} name                          - registry key, e.g. "razorpay"
 * @property {{orders: boolean, paymentLinks: boolean, refunds: boolean}} supports
 *
 * Every function takes ONE destructured options object whose first key is
 * `config` (a ResolvedProviderConfig) — never positional arguments, never a
 * raw DB row. See services/payments/razorpayProvider.js for the reference
 * implementation.
 *
 * @property {(o: {config: ResolvedProviderConfig, amountPaise: number, currency: string, receipt?: string, notes?: Object}) => Promise<Object>} createOrder
 * @property {(o: {config: ResolvedProviderConfig, amountPaise: number, currency: string, description?: string, expiresAtUnix?: number, customer?: Object, notes?: Object, callbackUrl?: string, referenceId?: string}) => Promise<Object>} createPaymentLink
 * @property {(o: {config: ResolvedProviderConfig, providerLinkId: string}) => Promise<Object>} cancelPaymentLink
 * @property {(o: {config: ResolvedProviderConfig, payload: Object}) => boolean} verifyClientSignature - SYNC, timing-safe
 * @property {(o: {config: ResolvedProviderConfig, rawBody: Buffer, headers: Object}) => boolean} verifyWebhookSignature - SYNC, timing-safe, raw bytes only
 * @property {(o: {rawBody: Buffer, parsedBody: Object, headers: Object}) => Object} parseWebhookEvent - SYNC, never throws; verify the signature FIRST
 * @property {(o: {config: ResolvedProviderConfig, providerPaymentId: string}) => Promise<Object>} fetchPayment
 * @property {(o: {config: ResolvedProviderConfig, providerOrderId: string}) => Promise<Object>} fetchOrder
 * @property {(o: {config: ResolvedProviderConfig, providerLinkId: string}) => Promise<Object>} fetchPaymentLink
 * @property {(o: {config: ResolvedProviderConfig}) => Promise<{ok: boolean, message: string, accountHint?: string, latencyMs?: number}>} testConnection
 */

const { APIError } = require("../../shared/lib/errors");
const logger = require("../../shared/lib/logger");

/**
 * Every export a provider module MUST expose as a function.
 * `name` and `supports` are checked separately (they are not functions).
 */
const REQUIRED_FUNCTIONS = [
  "createOrder",
  "createPaymentLink",
  "cancelPaymentLink",
  "verifyClientSignature",
  "verifyWebhookSignature",
  "parseWebhookEvent",
  "fetchPayment",
  "fetchOrder",
  "fetchPaymentLink",
  "testConnection",
];

/** @type {Map<string, PaymentProvider>} resolved, contract-checked providers */
const providers = new Map();

/** @type {Map<string, Function>} name -> factory, resolved on first getProvider */
const lazyFactories = new Map();

/**
 * Validate a provider implementation against the contract.
 * Throws (loudly, at registration/first-use time) rather than letting a broken
 * provider fail halfway through a live payment.
 *
 * @param {PaymentProvider} impl
 * @returns {PaymentProvider} the same impl, when valid
 * @throws {Error}
 */
function assertContract(impl) {
  if (!impl || typeof impl !== "object") {
    throw new Error("Payment provider implementation must be an object");
  }

  if (typeof impl.name !== "string" || impl.name.length === 0) {
    throw new Error("Payment provider must export a non-empty string `name`");
  }

  if (!impl.supports || typeof impl.supports !== "object") {
    throw new Error(
      `Payment provider "${impl.name}" must export a \`supports\` object { orders, paymentLinks, refunds }`,
    );
  }

  for (const capability of ["orders", "paymentLinks", "refunds"]) {
    if (typeof impl.supports[capability] !== "boolean") {
      throw new Error(
        `Payment provider "${impl.name}" must declare supports.${capability} as a boolean`,
      );
    }
  }

  const missing = REQUIRED_FUNCTIONS.filter(
    (fn) => typeof impl[fn] !== "function",
  );

  if (missing.length > 0) {
    throw new Error(
      `Payment provider "${impl.name}" is missing required function(s): ${missing.join(", ")}`,
    );
  }

  return impl;
}

/**
 * Register an already-loaded provider implementation.
 *
 * @param {string} name
 * @param {PaymentProvider} impl
 * @returns {PaymentProvider}
 */
function registerProvider(name, impl) {
  const key = normalizeName(name);
  assertContract(impl);

  if (impl.name !== key) {
    throw new Error(
      `Payment provider registered as "${key}" but exports name "${impl.name}"`,
    );
  }

  providers.set(key, impl);
  lazyFactories.delete(key);
  logger.info("Payment provider registered", { provider: key });
  return impl;
}

/**
 * Register a provider that is only `require()`d the first time it is used.
 *
 * This matters at boot: registering lazily means a provider module that does
 * not exist yet (or whose SDK is not installed yet) cannot crash server start.
 *
 * @param {string} name
 * @param {() => PaymentProvider} factory
 */
function registerLazy(name, factory) {
  const key = normalizeName(name);

  if (typeof factory !== "function") {
    throw new Error(
      `registerLazy("${key}") requires a factory function returning the provider module`,
    );
  }

  lazyFactories.set(key, factory);
  return key;
}

/**
 * Resolve a provider by name.
 *
 * @param {string} name
 * @returns {PaymentProvider}
 * @throws {APIError} PROVIDER_NOT_SUPPORTED (400) when unknown or unloadable
 */
function getProvider(name) {
  const key = normalizeName(name);

  if (providers.has(key)) {
    return providers.get(key);
  }

  const factory = lazyFactories.get(key);
  if (!factory) {
    throw new APIError(
      `Payment provider "${name}" is not supported`,
      400,
      "PROVIDER_NOT_SUPPORTED",
    );
  }

  let impl;
  try {
    impl = factory();
    assertContract(impl);
  } catch (error) {
    logger.error("Failed to load payment provider", {
      provider: key,
      error: error.message,
    });
    throw new APIError(
      `Payment provider "${name}" is not available: ${error.message}`,
      400,
      "PROVIDER_NOT_SUPPORTED",
    );
  }

  providers.set(key, impl);
  lazyFactories.delete(key);
  logger.info("Payment provider lazily loaded", { provider: key });
  return impl;
}

/**
 * All registered provider names (loaded + lazily registered), with the
 * capabilities of those already loaded.
 *
 * @returns {Array<{name: string, loaded: boolean, supports: Object|null}>}
 */
function listProviders() {
  const names = new Set([...providers.keys(), ...lazyFactories.keys()]);

  return [...names].sort().map((name) => {
    const impl = providers.get(name);
    return {
      name,
      loaded: Boolean(impl),
      supports: impl ? { ...impl.supports } : null,
    };
  });
}

function normalizeName(name) {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new APIError(
      "Payment provider name is required",
      400,
      "PROVIDER_NOT_SUPPORTED",
    );
  }
  return name.trim().toLowerCase();
}

module.exports = {
  registerProvider,
  registerLazy,
  getProvider,
  listProviders,
  assertContract,
  REQUIRED_FUNCTIONS,
};
