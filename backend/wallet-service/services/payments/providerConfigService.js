/**
 * Payment Provider Configuration Service
 *
 * THE ONLY MODULE IN THIS SERVICE THAT DECRYPTS PAYMENT CREDENTIALS.
 *
 * Nothing else may `require("../../utils/secretCrypto")` for the purpose of
 * reading a stored gateway secret. Controllers, routes, webhook handlers and
 * the top-up services all go through `resolveActiveConfig()` /
 * `resolveConfigForMode()` here, so there is exactly one place to audit when
 * asking "can a secret escape to HTTP?".
 *
 * CREDENTIAL SHAPE IS DESCRIPTOR-DRIVEN
 * -------------------------------------
 * This module no longer names credential columns. `./credentialDescriptors`
 * declares, per provider, which fields exist, whether each lives in a LEGACY
 * COLUMN (Razorpay's four, which never move) or in the `testCredentials` /
 * `liveCredentials` JSONB bag, and which legacy `{keyId, keySecret,
 * webhookSecret}` slot each field ALIASES onto. `readStoredField` /
 * `writeStoredField` below are the only code that knows the difference.
 *
 * SAFE-BY-DEFAULT READS
 * ---------------------
 * `SAFE_SELECT` is an explicit Prisma `select` that lists ONLY non-secret
 * columns; every read path that can reach an HTTP response uses it. NEVER add
 * an `*Enc` column — nor `testCredentials` / `liveCredentials`, whose entries
 * may be `{"enc": ...}` — to it. This
 * mirrors the credential-hiding approach in
 * `backend/partner-service/services/carrierAccountService.js`, where account
 * listings are projected down so API credentials never ride along.
 *
 * The `*Enc` columns are read in exactly three functions:
 *   - `resolveActiveConfig()` / `resolveConfigForMode()` — internal-only, their
 *     return value NEVER reaches a controller unmodified.
 *   - `getConfigSafe()` — reads them only to compute `keySecretSet` and a
 *     `maskSecret()` display string; the raw envelope is dropped on the floor.
 *
 * SECRET SEMANTICS on update (mirrors validation/paymentSchema.js):
 *   - field `undefined`  -> stored value UNCHANGED
 *   - field `""` / null  -> stored value CLEARED
 *   - field with a value -> stored value REPLACED (encrypted)
 * A masked display value (contains "•") is treated as UNCHANGED, so a UI that
 * naively re-posts what it rendered can never write a mask into the DB.
 *
 * CACHING
 *   - Redis `payment:config:<provider>` — the SAFE projection, TTL 300s.
 *   - module-level in-process map — the DECRYPTED config, TTL 60s. Never
 *     serialized anywhere; dies with the process.
 * Both are cleared by every write. Every Redis call is wrapped in try/catch:
 * a cache outage must never fail a config read, it only makes it slower.
 */

const { prisma } = require("../../config/database");
const { getRedisClient } = require("../../config/redis");
const logger = require("../../shared/lib/logger");
const {
  ValidationError,
  ConflictError,
  NotFoundError,
} = require("../../shared/lib/errors");
const {
  encryptSecret,
  decryptSecret,
  maskSecret,
} = require("../../utils/secretCrypto");
const { getProvider } = require("./index");
const {
  getCredentialDescriptor,
  describeFieldsForUi,
} = require("./credentialDescriptors");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDER = "razorpay";

/** Providers with a real implementation behind them. */
const IMPLEMENTED_PROVIDERS = ["razorpay", "ccavenue", "ccavenue_upi_qr"];

/** Listed in the admin UI, greyed out. No DB row is created for these. */
const COMING_SOON_PROVIDERS = ["stripe", "cashfree", "payu"];

const ALL_PROVIDERS = [...IMPLEMENTED_PROVIDERS, ...COMING_SOON_PROVIDERS];

/**
 * @deprecated Razorpay's event list, kept exported for back-compat only.
 * The RESPONSE path now reads `descriptor.webhookEvents`, because telling a
 * CCAvenue operator to register `payment.captured` names an event that does not
 * exist in their dashboard.
 */
const WEBHOOK_EVENTS = [
  "payment.captured",
  "payment.failed",
  "payment_link.paid",
  "payment_link.expired",
  "refund.processed",
];

/** Orders in these statuses are still in flight and pin the current mode. */
const IN_FLIGHT_ORDER_STATUSES = ["CREATED", "PENDING"];

const CONFIG_CACHE_PREFIX = "payment:config:";
const CONFIG_CACHE_TTL_SECONDS = 300;
const DECRYPTED_CACHE_TTL_MS = 60 * 1000;

/**
 * NON-SECRET columns only. Anything added here is, by definition, safe to
 * serialize into an HTTP response. NEVER add a `*Enc` column.
 */
const SAFE_SELECT = {
  id: true,
  clientId: true,
  provider: true,
  isEnabled: true,
  mode: true,
  testKeyId: true,
  liveKeyId: true,
  currency: true,
  minAmount: true,
  maxAmount: true,
  quickAmounts: true,
  paymentLinkExpiryHours: true,
  lastTestedAt: true,
  lastTestStatus: true,
  lastTestMessage: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * SAFE_SELECT + the encrypted columns. Internal use ONLY — the three functions
 * documented in the file header. A row selected with this must never be
 * returned to a caller without passing through `toSafeView()`.
 */
const SECRET_SELECT = {
  ...SAFE_SELECT,
  testKeySecretEnc: true,
  testWebhookSecretEnc: true,
  liveKeySecretEnc: true,
  liveWebhookSecretEnc: true,
  // The credential bag can hold `{"enc": ...}` entries, so it is as sensitive
  // as an `*Enc` column and belongs ONLY here — never in SAFE_SELECT.
  testCredentials: true,
  liveCredentials: true,
};

// ---------------------------------------------------------------------------
// Credential storage layer — THE ONLY CODE THAT KNOWS WHERE A FIELD LIVES
// ---------------------------------------------------------------------------
//
// A descriptor field is backed either by a LEGACY COLUMN (`field.legacyColumns`
// — Razorpay's four columns, which never move) or by the CREDENTIAL BAG
// (`testCredentials` / `liveCredentials` JSONB), keyed by `field.name` and
// shaped `{ "<name>": {"v": plaintext} | {"enc": envelope} }`.
//
// Everything above this layer talks in terms of `{plain, enc}` and never names
// a column.

/** @param {"TEST"|"LIVE"} mode */
function modeKey(mode) {
  return mode === "LIVE" ? "live" : "test";
}

/** @param {"TEST"|"LIVE"} mode */
function bagColumn(mode) {
  return mode === "LIVE" ? "liveCredentials" : "testCredentials";
}

/**
 * Read one credential field out of a SECRET_SELECT row.
 *
 * @param {Object} row
 * @param {"TEST"|"LIVE"} mode
 * @param {Object} field CredentialField
 * @returns {{plain: string|null, enc: string|null}}
 */
function readStoredField(row, mode, field) {
  if (field.legacyColumns) {
    const entry = field.legacyColumns[modeKey(mode)] || {};
    return {
      plain: entry.plain ? (row[entry.plain] ?? null) : null,
      enc: entry.enc ? (row[entry.enc] ?? null) : null,
    };
  }

  const bag = row[bagColumn(mode)];
  const entry = bag && typeof bag === "object" ? bag[field.name] : null;
  if (!entry || typeof entry !== "object") {
    return { plain: null, enc: null };
  }

  // The `v` / `enc` discriminant makes it structurally impossible to mistake a
  // plaintext value for ciphertext, so we honour the stored shape, not the
  // declared storageClass.
  return {
    plain: typeof entry.v === "string" ? entry.v : null,
    enc: typeof entry.enc === "string" ? entry.enc : null,
  };
}

/**
 * Turn a resolved patch into the write it implies.
 *
 * @param {Object} field CredentialField
 * @param {"TEST"|"LIVE"} mode
 * @param {{write: boolean, value: string|null}} patchResult already storage-ready
 *   (an AES envelope for an encrypted field, plaintext for a plaintext field)
 * @returns {{column: Object, bagEntry: [string, Object|null]|null}} a Prisma data
 *   fragment and/or a bag patch (`[name, null]` means "remove this key")
 */
function writeStoredField(field, mode, patchResult) {
  if (field.legacyColumns) {
    const entry = field.legacyColumns[modeKey(mode)] || {};
    const column = field.storageClass === "encrypted" ? entry.enc : entry.plain;
    return { column: { [column]: patchResult.value }, bagEntry: null };
  }

  if (patchResult.value === null) {
    return { column: {}, bagEntry: [field.name, null] };
  }

  return {
    column: {},
    bagEntry: [
      field.name,
      field.storageClass === "encrypted"
        ? { enc: patchResult.value }
        : { v: patchResult.value },
    ],
  };
}

// ---------------------------------------------------------------------------
// In-process decrypted cache (never leaves this module)
// ---------------------------------------------------------------------------

/** @type {Map<string, {value: Object, expiresAt: number}>} */
const decryptedCache = new Map();

function readDecryptedCache(key) {
  const hit = decryptedCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    decryptedCache.delete(key);
    return null;
  }
  return hit.value;
}

function writeDecryptedCache(key, value) {
  decryptedCache.set(key, {
    value,
    expiresAt: Date.now() + DECRYPTED_CACHE_TTL_MS,
  });
}

function clearDecryptedCache(provider) {
  for (const key of decryptedCache.keys()) {
    if (key.startsWith(`${provider}:`)) {
      decryptedCache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Redis cache helpers — failures degrade to a DB read, never to an error
// ---------------------------------------------------------------------------

async function readSafeCache(provider) {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(`${CONFIG_CACHE_PREFIX}${provider}`);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    logger.warn("Payment config cache read failed (falling back to DB)", {
      provider,
      error: error.message,
    });
    return null;
  }
}

async function writeSafeCache(provider, view) {
  try {
    const redis = getRedisClient();
    await redis.set(`${CONFIG_CACHE_PREFIX}${provider}`, JSON.stringify(view), {
      EX: CONFIG_CACHE_TTL_SECONDS,
    });
  } catch (error) {
    logger.warn("Payment config cache write failed", {
      provider,
      error: error.message,
    });
  }
}

/**
 * Drop every cached copy of a provider's config. Called after EVERY write.
 * @param {string} provider
 */
async function invalidateConfigCache(provider) {
  clearDecryptedCache(provider);

  // The provider SDK client pins the credentials it was constructed with, so a
  // credential change or a TEST/LIVE switch must drop its memoised instance too
  // — otherwise the old keys keep being used until the process restarts.
  try {
    const impl = getProvider(provider);
    if (typeof impl.resetInstanceCache === "function") {
      impl.resetInstanceCache();
    }
  } catch (error) {
    logger.warn("Provider instance cache reset skipped", {
      provider,
      error: error.message,
    });
  }

  try {
    const redis = getRedisClient();
    await redis.del(`${CONFIG_CACHE_PREFIX}${provider}`);
  } catch (error) {
    logger.warn("Payment config cache invalidation failed", {
      provider,
      error: error.message,
    });
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function toNumber(value) {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

function normalizeQuickAmounts(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(toNumber)
    .filter((n) => typeof n === "number" && !Number.isNaN(n));
}

/** A value the UI rendered as a mask must never be persisted. */
function isMaskedValue(value) {
  return typeof value === "string" && value.includes("•");
}

function assertKnownProvider(provider) {
  if (!ALL_PROVIDERS.includes(provider)) {
    const error = new ValidationError(
      `Unsupported payment provider '${provider}'`,
    );
    error.code = "PROVIDER_NOT_SUPPORTED";
    throw error;
  }
}

function conflict(message, code, details = null) {
  const error = new ConflictError(message);
  error.code = code;
  error.details = details;
  return error;
}

function publicApiBase() {
  return (
    process.env.PAYMENT_PUBLIC_API_URL ||
    process.env.PUBLIC_API_URL ||
    ""
  ).replace(/\/+$/, "");
}

function buildWebhookUrl(provider) {
  return `${publicApiBase()}/api/v1/wallet/topup/webhook/${provider}`;
}

/**
 * Where a REDIRECT_POST gateway posts the browser back to. Null for providers
 * that settle in a checkout modal and therefore never leave the SPA.
 */
function buildReturnUrl(provider) {
  return `${publicApiBase()}/api/v1/wallet/topup/return/${provider}`;
}

/**
 * The descriptor for a provider, or null for a coming-soon provider that has
 * none yet. Used only where a missing descriptor is a legitimate state.
 */
function descriptorOrNull(provider) {
  try {
    return getCredentialDescriptor(provider);
  } catch {
    return null;
  }
}

/**
 * The masked-but-safe stub returned for a provider that has no implementation
 * yet. No DB row is created for these.
 */
function comingSoonView(provider) {
  const emptySide = {
    keyId: null,
    keySecretSet: false,
    keySecretMasked: null,
    webhookSecretSet: false,
    credentials: {},
  };

  const descriptor = descriptorOrNull(provider);

  return {
    provider,
    clientId: null,
    isEnabled: false,
    mode: "TEST",
    test: { ...emptySide },
    live: { ...emptySide },
    currency: "INR",
    minAmount: null,
    maxAmount: null,
    quickAmounts: [],
    paymentLinkExpiryHours: null,
    webhookUrl: buildWebhookUrl(provider),
    // Per-provider, NOT the module constant: a coming-soon gateway must not
    // tell the operator to register Razorpay's event names.
    webhookEvents: descriptor ? descriptor.webhookEvents : [],
    credentialFields: descriptor ? describeFieldsForUi(provider) : [],
    returnFlow: descriptor ? descriptor.returnFlow : null,
    usesReturnEndpoint: descriptor ? descriptor.usesReturnEndpoint : false,
    returnUrl:
      descriptor && descriptor.usesReturnEndpoint
        ? buildReturnUrl(provider)
        : null,
    lastTestedAt: null,
    lastTestStatus: null,
    lastTestMessage: null,
    updatedAt: null,
    updatedBy: null,
    comingSoon: true,
  };
}

/**
 * Decrypt for display only. Never throws: a rotated PAYMENT_SECRET_ENC_KEY must
 * leave the admin screen usable (so the operator can re-enter credentials)
 * rather than 500-ing the whole settings page.
 *
 * @returns {{set: boolean, masked: string|null, unreadable: boolean}}
 */
function describeSecret(envelope) {
  if (!envelope) {
    return { set: false, masked: null, unreadable: false };
  }

  try {
    return {
      set: true,
      masked: maskSecret(decryptSecret(envelope)),
      unreadable: false,
    };
  } catch (error) {
    logger.warn(
      "Stored payment credential could not be decrypted for display",
      {
        code: error.code,
      },
    );
    return { set: true, masked: null, unreadable: true };
  }
}

/**
 * Project a DB row (SAFE_SELECT or SECRET_SELECT) into the masked admin view.
 * This is the ONLY function allowed to touch `*Enc` values for display, and it
 * drops them: the returned object contains no ciphertext.
 */
/**
 * Describe ONE credential field for the admin UI.
 *
 * `value` is populated ONLY for a revealable plaintext field. An encrypted
 * field exposes a `masked` display string and never its plaintext, and the
 * descriptor integrity check makes `revealable + encrypted` impossible anyway —
 * the condition here is belt and braces.
 *
 * @returns {{set: boolean, masked: string|null, value: string|null, unreadable: boolean}}
 */
function describeCredentialField(row, mode, field) {
  const stored = readStoredField(row, mode, field);

  if (field.storageClass === "encrypted" || stored.enc) {
    const described = describeSecret(stored.enc);
    return {
      set: described.set,
      masked: described.masked,
      value: null,
      unreadable: described.unreadable,
    };
  }

  const plain = stored.plain ?? null;
  return {
    set: Boolean(plain),
    masked: plain ? maskSecret(plain) : null,
    value: field.revealable ? plain : null,
    unreadable: false,
  };
}

/**
 * Project a DB row (SECRET_SELECT) into the masked admin view for one mode.
 * Returns both the NEW per-field shape and the map of legacy aliases the old
 * `{keyId, keySecretSet, ...}` side view is derived from.
 * @private
 */
function buildSideView(row, descriptor, mode) {
  const credentials = {};
  /** @type {Record<string, {field: Object, entry: Object}>} */
  const aliases = {};
  let unreadable = false;

  for (const field of descriptor.fields) {
    const entry = describeCredentialField(row, mode, field);
    credentials[field.name] = entry;
    if (entry.unreadable) unreadable = true;

    for (const alias of field.aliasesTo || []) {
      aliases[alias] = { field, entry };
    }
  }

  const keyIdAlias = aliases.keyId;
  const keySecretAlias = aliases.keySecret;
  const webhookAlias = aliases.webhookSecret;

  return {
    unreadable,
    side: {
      // The legacy shape the current admin card renders, derived from the
      // aliased fields so CCAvenue's accessCode/workingKey land in the same
      // slots Razorpay's keyId/keySecret/webhookSecret do.
      keyId: keyIdAlias ? keyIdAlias.entry.value : null,
      keySecretSet: keySecretAlias ? keySecretAlias.entry.set : false,
      keySecretMasked: keySecretAlias ? keySecretAlias.entry.masked : null,
      webhookSecretSet: webhookAlias ? webhookAlias.entry.set : false,
      credentials,
    },
  };
}

function toSafeView(row) {
  const descriptor = getCredentialDescriptor(row.provider);

  const test = buildSideView(row, descriptor, "TEST");
  const live = buildSideView(row, descriptor, "LIVE");

  const credentialsUnreadable = test.unreadable || live.unreadable;

  const view = {
    provider: row.provider,
    clientId: row.clientId ?? null,
    isEnabled: row.isEnabled,
    mode: row.mode,
    test: test.side,
    live: live.side,
    currency: row.currency,
    minAmount: toNumber(row.minAmount),
    maxAmount: toNumber(row.maxAmount),
    quickAmounts: normalizeQuickAmounts(row.quickAmounts),
    paymentLinkExpiryHours: row.paymentLinkExpiryHours,
    // Computed server-side so the admin can copy-paste it straight into the
    // gateway dashboard instead of hand-assembling the public URL.
    webhookUrl: buildWebhookUrl(row.provider),
    // Per-provider, NOT the module constant.
    webhookEvents: descriptor.webhookEvents,
    credentialFields: describeFieldsForUi(row.provider),
    returnFlow: descriptor.returnFlow,
    usesReturnEndpoint: descriptor.usesReturnEndpoint,
    returnUrl: descriptor.usesReturnEndpoint
      ? buildReturnUrl(row.provider)
      : null,
    lastTestedAt: row.lastTestedAt ?? null,
    lastTestStatus: row.lastTestStatus ?? null,
    lastTestMessage: row.lastTestMessage ?? null,
    updatedAt: row.updatedAt ?? null,
    updatedBy: row.updatedBy ?? null,
    comingSoon: false,
  };

  if (credentialsUnreadable) {
    view.credentialsUnreadable = true;
  }

  return view;
}

// ---------------------------------------------------------------------------
// Row access / lazy seeding
// ---------------------------------------------------------------------------

/**
 * Fetch (creating if absent) the platform-level config row for a provider.
 *
 * Lazy seeding exists so a freshly migrated environment never 404s on the
 * settings screen: the admin opens Settings › Payments and sees a disabled
 * TEST-mode Razorpay card ready to fill in.
 *
 * @param {string} [provider="razorpay"]
 * @param {Object} [options]
 * @param {Object} [options.select=SAFE_SELECT] Prisma selection to return
 * @returns {Promise<Object>} the config row
 */
async function getOrCreatePlatformConfig(
  provider = DEFAULT_PROVIDER,
  { select = SAFE_SELECT } = {},
) {
  assertKnownProvider(provider);

  const existing = await prisma.paymentProviderConfig.findFirst({
    where: { provider, clientId: null },
    select,
  });

  if (existing) return existing;

  try {
    return await prisma.paymentProviderConfig.create({
      data: { provider, clientId: null, isEnabled: false, mode: "TEST" },
      select,
    });
  } catch (error) {
    // Two admins opening the settings page at once: one create wins, the other
    // re-reads. Any other error is a genuine failure.
    const seeded = await prisma.paymentProviderConfig.findFirst({
      where: { provider, clientId: null },
      select,
    });
    if (seeded) return seeded;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Read APIs
// ---------------------------------------------------------------------------

/**
 * Every provider the admin screen shows, implemented ones first.
 * @returns {Promise<Array<Object>>}
 */
async function listConfigs() {
  const views = [];

  for (const provider of IMPLEMENTED_PROVIDERS) {
    views.push(await getConfigSafe(provider));
  }

  // No DB row is created for these — they exist purely so the UI can render a
  // "coming soon" card without a second source of truth.
  for (const provider of COMING_SOON_PROVIDERS) {
    views.push(comingSoonView(provider));
  }

  return views;
}

/**
 * The masked admin view of one provider. Cached in Redis for 300s.
 * @param {string} provider
 * @returns {Promise<Object>}
 */
async function getConfigSafe(provider) {
  assertKnownProvider(provider);

  if (COMING_SOON_PROVIDERS.includes(provider)) {
    return comingSoonView(provider);
  }

  const cached = await readSafeCache(provider);
  if (cached) return cached;

  const row = await getOrCreatePlatformConfig(provider, {
    select: SECRET_SELECT,
  });

  const view = toSafeView(row);
  await writeSafeCache(provider, view);
  return view;
}

/**
 * Customer-facing, NON-SECRET view used by the Add Money screen.
 *
 * Returns `{ enabled: false, provider: null }` with HTTP 200 (never an error)
 * when no gateway is usable, so the UI simply hides Add Money instead of
 * showing an error toast to an end customer.
 *
 * @returns {Promise<Object>}
 */
async function getActiveProviderPublic() {
  const row = await prisma.paymentProviderConfig.findFirst({
    where: { isEnabled: true, clientId: null },
    select: { provider: true, mode: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!row) {
    return { enabled: false, provider: null };
  }

  let config;
  try {
    config = await resolveConfigForMode(row.provider, row.mode, {
      requireEnabled: false,
    });
  } catch (error) {
    // Enabled but half-configured (e.g. a credential was cleared out of band),
    // or its stored secrets no longer decrypt: treat as unavailable rather than
    // handing the browser a broken checkout key. HTTP 200 either way — the Add
    // Money screen hides itself instead of erroring at an end customer.
    logger.warn(
      "Enabled payment provider is missing credentials for its mode",
      {
        provider: row.provider,
        mode: row.mode,
        code: error.code ?? null,
        error: error.message,
      },
    );
    return { enabled: false, provider: null };
  }

  // The provider module may not be registered yet (CCAvenue lands in a later
  // wave); a missing impl must not break the Add Money screen.
  let supports = null;
  try {
    const impl = getProvider(row.provider);
    supports = impl.supports ? { ...impl.supports } : null;
  } catch (error) {
    logger.warn("Active payment provider implementation is not registered", {
      provider: row.provider,
      error: error.message,
    });
  }

  return {
    enabled: true,
    provider: row.provider,
    mode: row.mode,
    // The PUBLIC id — Razorpay's key id, CCAvenue's access code. Designed to
    // reach the browser; it rides in the checkout/redirect payload either way.
    keyId: config.keyId ?? null,
    currency: config.currency,
    minAmount: config.minAmount,
    maxAmount: config.maxAmount,
    quickAmounts: config.quickAmounts,
    // Additive: lets the frontend pick the checkout style and hide payment-link
    // UI for a provider that does not support it.
    returnFlow: config.descriptor.returnFlow,
    supports,
  };
}

/**
 * The name of the single enabled platform gateway, or null when none is on.
 *
 * `initiateSelfTopup` uses this instead of defaulting to Razorpay, so a
 * CCAvenue-only deployment stops silently minting Razorpay orders.
 *
 * @returns {Promise<string|null>}
 */
async function resolveActiveProviderName() {
  const row = await prisma.paymentProviderConfig.findFirst({
    where: { clientId: null, isEnabled: true },
    select: { provider: true },
  });

  return row ? row.provider : null;
}

// ---------------------------------------------------------------------------
// Credential resolution (INTERNAL — returns plaintext secrets)
// ---------------------------------------------------------------------------

/**
 * Resolve decrypted credentials for an explicit mode.
 *
 * The webhook handler needs this: an order created while the platform was in
 * TEST mode must still verify its signature after an admin flips to LIVE, so
 * verification always resolves against the ORDER's snapshotted mode, not the
 * current one.
 *
 * @param {string} provider
 * @param {"TEST"|"LIVE"} mode
 * @param {Object} [options]
 * @param {boolean} [options.requireEnabled=true] set false for test-connection,
 *   which must work BEFORE the provider is enabled.
 * @returns {Promise<Object>} resolved config INCLUDING plaintext secrets
 */
async function resolveConfigForMode(
  provider,
  mode,
  { requireEnabled = true } = {},
) {
  assertKnownProvider(provider);

  if (mode !== "TEST" && mode !== "LIVE") {
    throw new ValidationError(`Invalid provider mode '${mode}'`);
  }

  const cacheKey = `${provider}:${mode}:${requireEnabled ? "enabled" : "any"}`;
  const cached = readDecryptedCache(cacheKey);
  if (cached) return cached;

  const row = await prisma.paymentProviderConfig.findFirst({
    where: { provider, clientId: null },
    select: SECRET_SELECT,
  });

  if (!row) {
    throw new NotFoundError(`Payment provider '${provider}' is not configured`);
  }

  if (requireEnabled && !row.isEnabled) {
    throw conflict(
      `Payment provider '${provider}' is disabled`,
      "PROVIDER_DISABLED",
    );
  }

  const isLive = mode === "LIVE";
  const mk = modeKey(mode);
  const descriptor = getCredentialDescriptor(provider);

  // Canonical `{fieldName: plaintext}` map, built by walking the descriptor —
  // no column is named here.
  /** @type {Record<string, string|null>} */
  const credentials = {};
  const missing = [];

  for (const field of descriptor.fields) {
    const stored = readStoredField(row, mode, field);

    let value = null;
    if (field.storageClass === "encrypted") {
      if (stored.enc) value = decryptSecret(stored.enc);
    } else {
      value = stored.plain ?? null;
    }

    credentials[field.name] = value ?? null;

    if (field.requiredForEnable && !value) {
      missing.push(`${mk}.${field.name}`);
    }
  }

  if (missing.length > 0) {
    throw conflict(
      `Payment provider '${provider}' is missing ${mode} credentials: ${missing.join(", ")}`,
      "PROVIDER_NOT_CONFIGURED",
      { missing, mode },
    );
  }

  // >>> THE ALIAS PROJECTION — why nothing downstream changed <<<
  // Each field fans its plaintext out onto the legacy `{keyId, keySecret,
  // webhookSecret}` keys every consumer already reads. Razorpay's mapping is
  // the identity; CCAvenue's accessCode fills `keyId` and its workingKey fills
  // BOTH secret slots, which is exactly right — the same key encrypts the
  // request and decrypts the response notification.
  const aliased = {};
  for (const field of descriptor.fields) {
    for (const alias of field.aliasesTo || []) {
      aliased[alias] = credentials[field.name];
    }
  }

  const resolved = {
    provider: row.provider,
    mode,
    ...aliased,
    credentials,
    descriptor,
    currency: row.currency,
    minAmount: toNumber(row.minAmount),
    maxAmount: toNumber(row.maxAmount),
    quickAmounts: normalizeQuickAmounts(row.quickAmounts),
    paymentLinkExpiryHours: row.paymentLinkExpiryHours,
    isTest: !isLive,
  };

  writeDecryptedCache(cacheKey, resolved);
  return resolved;
}

/**
 * Resolve decrypted credentials for the provider's CURRENT mode.
 * @param {string} [provider="razorpay"]
 * @returns {Promise<Object>} resolved config INCLUDING plaintext secrets
 */
async function resolveActiveConfig(provider = DEFAULT_PROVIDER) {
  assertKnownProvider(provider);

  const row = await prisma.paymentProviderConfig.findFirst({
    where: { provider, clientId: null },
    select: { mode: true },
  });

  if (!row) {
    throw new NotFoundError(`Payment provider '${provider}' is not configured`);
  }

  return resolveConfigForMode(provider, row.mode);
}

// ---------------------------------------------------------------------------
// Write APIs
// ---------------------------------------------------------------------------

/**
 * Resolve one incoming credential field into a Prisma update value.
 *
 * @returns {{write: boolean, value: string|null, changed: boolean}}
 */
function resolveSecretPatch(incoming, storedEnc) {
  if (incoming === undefined) {
    return { write: false, value: storedEnc ?? null, changed: false };
  }

  if (isMaskedValue(incoming)) {
    // The UI echoed back what it rendered. Treat as "unchanged" — writing a
    // mask would silently destroy a live credential.
    return { write: false, value: storedEnc ?? null, changed: false };
  }

  if (incoming === null || incoming === "") {
    return { write: true, value: null, changed: Boolean(storedEnc) };
  }

  return { write: true, value: encryptSecret(incoming), changed: true };
}

function resolvePlainPatch(incoming, stored) {
  if (incoming === undefined) {
    return { write: false, value: stored ?? null, changed: false };
  }

  const next = incoming === "" || incoming === null ? null : incoming;
  return { write: true, value: next, changed: next !== (stored ?? null) };
}

/**
 * The legacy flat body keys a descriptor field answers to, derived from its
 * alias targets: `keySecret` -> `testKeySecret` / `liveKeySecret`.
 *
 * For Razorpay (identity aliases) this reproduces the exact six key names the
 * body has always used. For CCAvenue it lets a caller that still posts
 * `liveKeySecret` reach `workingKey`.
 * @private
 */
function legacyFlatKeys(field, mk) {
  return (field.aliasesTo || []).map(
    (alias) => `${mk}${alias[0].toUpperCase()}${alias.slice(1)}`,
  );
}

/**
 * Read one incoming credential value: the new `credentials.<mode>.<field>`
 * shape first, falling back to the legacy flat keys for one release.
 * `undefined` means "not supplied" — i.e. leave the stored value alone.
 * @private
 */
function readIncomingCredential(patch, mk, field) {
  const supplied = patch.credentials?.[mk]?.[field.name];
  if (supplied !== undefined) return supplied;

  for (const key of legacyFlatKeys(field, mk)) {
    if (patch[key] !== undefined) return patch[key];
  }

  return undefined;
}

/**
 * Apply the shared patch semantics to one descriptor field.
 *
 * The mask guard runs for PLAINTEXT fields too: a UI that renders `AV••••1234`
 * for an access code and naively re-posts it must not write the mask into the
 * DB.
 * @private
 */
function resolveCredentialPatch(field, incoming, stored) {
  if (isMaskedValue(incoming)) {
    const current =
      field.storageClass === "encrypted" ? stored.enc : stored.plain;
    return { write: false, value: current ?? null, changed: false };
  }

  return field.storageClass === "encrypted"
    ? resolveSecretPatch(incoming, stored.enc)
    : resolvePlainPatch(incoming, stored.plain);
}

/**
 * The name a credential change is audited under. Legacy-column fields keep
 * their historical flat name (`testKeyId`) so existing Razorpay audit rows stay
 * greppable; bag fields use `<mode>.<fieldName>`.
 * @private
 */
function auditFieldName(field, mk) {
  if (field.legacyColumns) {
    const [legacy] = legacyFlatKeys(field, mk);
    if (legacy) return legacy;
  }
  return `${mk}.${field.name}`;
}

/**
 * Refuse a TEST<->LIVE flip while orders created in the CURRENT mode are still
 * in flight. Confirmed product decision: there is NO force override — the admin
 * must let the in-flight orders settle (or cancel them) first, otherwise a
 * webhook for a live payment would arrive while the platform holds only the
 * other mode's keys.
 */
async function assertNoBlockingOrders(provider, currentMode) {
  const where = {
    provider,
    mode: currentMode,
    status: { in: IN_FLIGHT_ORDER_STATUSES },
  };

  const total = await prisma.paymentOrder.count({ where });
  if (total === 0) return;

  const blockingOrders = await prisma.paymentOrder.findMany({
    where,
    select: {
      id: true,
      walletUserId: true,
      amount: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  throw conflict(
    `Cannot switch ${provider} out of ${currentMode} mode: ${total} order(s) are still in progress`,
    "PENDING_ORDERS_BLOCK_MODE_SWITCH",
    {
      total,
      blockingOrders: blockingOrders.map((order) => ({
        orderId: order.id,
        walletUserId: order.walletUserId,
        amount: toNumber(order.amount),
        status: order.status,
        createdAt: order.createdAt,
      })),
    },
  );
}

/**
 * SINGLE ACTIVE GATEWAY.
 *
 * Exactly one platform gateway may be enabled at a time. Enabling a provider
 * therefore disables every other enabled one — but only once their in-flight
 * orders have settled, for the same reason a TEST<->LIVE flip is blocked: a
 * webhook for a payment taken on the outgoing gateway would arrive after the
 * platform stopped considering that gateway active.
 *
 * Reuses `assertNoBlockingOrders` so the `details` payload is byte-identical to
 * the mode-switch guard's and the admin `AlertDialog` renders it unchanged.
 * There is NO force override.
 *
 * @returns {Promise<Array<{id: string, provider: string, mode: string}>>} rows to disable
 */
async function collectProvidersToDisable(provider) {
  const others = await prisma.paymentProviderConfig.findMany({
    where: { clientId: null, isEnabled: true, provider: { not: provider } },
    select: { id: true, provider: true, mode: true },
  });

  for (const other of others) {
    try {
      await assertNoBlockingOrders(other.provider, other.mode);
    } catch (error) {
      if (error.code !== "PENDING_ORDERS_BLOCK_MODE_SWITCH") throw error;

      throw conflict(
        `Cannot enable ${provider}: ${other.provider} still has ${error.details.total} order(s) in progress`,
        "PENDING_ORDERS_BLOCK_PROVIDER_SWITCH",
        error.details,
      );
    }
  }

  return others;
}

/**
 * Update a provider's configuration.
 *
 * @param {string} provider
 * @param {Object} patch validated body (validation/paymentSchema.js)
 * @param {Object} actor `req.user`
 * @param {Object} [reqMeta] `{ ipAddress, userAgent }`
 * @returns {Promise<Object>} the masked admin view
 */
async function updateConfig(provider, patch, actor, reqMeta = {}) {
  assertKnownProvider(provider);

  if (COMING_SOON_PROVIDERS.includes(provider)) {
    const error = new ValidationError(
      `Payment provider '${provider}' is not available yet`,
    );
    error.code = "PROVIDER_NOT_SUPPORTED";
    throw error;
  }

  const current = await getOrCreatePlatformConfig(provider, {
    select: SECRET_SELECT,
  });

  const nextMode = patch.mode ?? current.mode;

  if (patch.mode && patch.mode !== current.mode) {
    await assertNoBlockingOrders(provider, current.mode);
  }

  const nextModeKey = modeKey(nextMode);
  const descriptor = getCredentialDescriptor(provider);

  // --- credential merge (descriptor-driven) ---------------------------------
  // One pass over every field x every mode. Reads the new
  // `credentials.<mode>.<field>` shape, falls back to the legacy flat keys, and
  // applies the unchanged undefined/mask/clear/replace semantics.
  /** @type {Array<{field: Object, mode: string, mk: string, stored: Object, result: Object}>} */
  const credentialPatches = [];

  for (const field of descriptor.fields) {
    for (const mk of ["test", "live"]) {
      const mode = mk === "live" ? "LIVE" : "TEST";
      const stored = readStoredField(current, mode, field);
      const incoming = readIncomingCredential(patch, mk, field);

      credentialPatches.push({
        field,
        mode,
        mk,
        stored,
        result: resolveCredentialPatch(field, incoming, stored),
      });
    }
  }

  /** The value a field WILL hold in `mode` once this patch lands. @private */
  const effectiveValue = (field, mode) => {
    const entry = credentialPatches.find(
      (cp) => cp.field.name === field.name && cp.mode === mode,
    );
    return entry ? entry.result.value : null;
  };

  const nextEnabled =
    patch.isEnabled === undefined ? current.isEnabled : patch.isEnabled;

  // --- enabling guard -------------------------------------------------------
  // Every `requiredForEnable` field must be present for the mode that WILL be
  // active, counting values already stored. Enabling a gateway with a missing
  // webhook/working key would accept unverifiable notifications — refuse it up
  // front.
  if (nextEnabled) {
    const missing = descriptor.fields
      .filter(
        (field) => field.requiredForEnable && !effectiveValue(field, nextMode),
      )
      .map((field) => `${nextModeKey}.${field.name}`);

    if (missing.length > 0) {
      const error = new ValidationError(
        `Cannot enable ${provider} in ${nextMode} mode — missing: ${missing.join(", ")}`,
        { missing, mode: nextMode },
      );
      error.code = "PROVIDER_CREDENTIALS_INCOMPLETE";
      throw error;
    }
  }

  // --- single-active-gateway guard (BEFORE the transaction) ----------------
  // The blocking-order counts are reads that must not hold a write transaction
  // open, and a refusal here must leave the DB untouched.
  const providersToDisable = nextEnabled
    ? await collectProvidersToDisable(provider)
    : [];

  // --- build the Prisma payload + the audit trail --------------------------
  const data = { updatedBy: actor?.id ?? null };
  const changedFields = [];

  const plainFields = {
    isEnabled: patch.isEnabled,
    mode: patch.mode,
    currency: patch.currency,
    minAmount: patch.minAmount,
    maxAmount: patch.maxAmount,
    quickAmounts: patch.quickAmounts,
    paymentLinkExpiryHours: patch.paymentLinkExpiryHours,
  };

  for (const [field, value] of Object.entries(plainFields)) {
    if (value === undefined) continue;
    data[field] = value;
    changedFields.push({
      field,
      from:
        field === "quickAmounts"
          ? normalizeQuickAmounts(current[field])
          : toAuditValue(current[field]),
      to: field === "quickAmounts" ? normalizeQuickAmounts(value) : value,
    });
  }

  // Bag columns are rewritten wholesale, so start from a copy of what is stored
  // and only touch the keys this patch actually writes.
  /** @type {Record<string, Object|null>} */
  const bags = {};

  for (const { field, mode, mk, stored, result } of credentialPatches) {
    if (!result.write) continue;

    const { column, bagEntry } = writeStoredField(field, mode, result);
    Object.assign(data, column);

    if (bagEntry) {
      const col = bagColumn(mode);
      if (bags[col] === undefined) {
        const currentBag = current[col];
        bags[col] =
          currentBag && typeof currentBag === "object" ? { ...currentBag } : {};
      }
      const [name, value] = bagEntry;
      if (value === null) delete bags[col][name];
      else bags[col][name] = value;
    }

    if (field.storageClass === "encrypted") {
      // NEVER audit the value — only that it changed and whether it was cleared.
      changedFields.push({
        field: auditFieldName(field, mk),
        changed: true,
        cleared: result.value === null,
      });
    } else {
      // A plaintext credential (Razorpay key id, CCAvenue merchant id / access
      // code) is public by design — safe to audit with its before/after.
      changedFields.push({
        field: auditFieldName(field, mk),
        from: stored.plain ?? null,
        to: result.value,
      });
    }
  }

  for (const [col, bag] of Object.entries(bags)) {
    // An emptied bag is stored as NULL rather than `{}` so "nothing configured"
    // has exactly one representation.
    data[col] = Object.keys(bag).length > 0 ? bag : null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.paymentProviderConfig.update({
      where: { id: current.id },
      data,
      select: SECRET_SELECT,
    });

    // Single active gateway: turn every other enabled platform gateway off, in
    // the same transaction that turns this one on.
    for (const other of providersToDisable) {
      await tx.paymentProviderConfig.update({
        where: { id: other.id },
        data: { isEnabled: false, updatedBy: actor?.id ?? null },
      });

      await tx.auditLog.create({
        data: {
          userId: actor?.id ?? null,
          action: "PAYMENT_PROVIDER_AUTO_DISABLED",
          resource: "PaymentProviderConfig",
          resourceId: other.id,
          details: {
            provider: other.provider,
            reason: "SINGLE_ACTIVE_GATEWAY",
            enabledProvider: provider,
          },
          ipAddress: reqMeta.ipAddress ?? null,
          userAgent: reqMeta.userAgent ?? null,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actor?.id ?? null,
        action: "PAYMENT_PROVIDER_UPDATED",
        resource: "PaymentProviderConfig",
        resourceId: row.id,
        details: {
          provider,
          mode: row.mode,
          isEnabled: row.isEnabled,
          changedFields,
        },
        ipAddress: reqMeta.ipAddress ?? null,
        userAgent: reqMeta.userAgent ?? null,
      },
    });

    return row;
  });

  // EVERY touched provider, not just the patched one — an auto-disabled gateway
  // whose cached view still said `isEnabled: true` would keep being offered.
  await invalidateConfigCache(provider);
  for (const other of providersToDisable) {
    await invalidateConfigCache(other.provider);
  }

  logger.info("Payment provider configuration updated", {
    provider,
    mode: updated.mode,
    isEnabled: updated.isEnabled,
    changedFields: changedFields.map((c) => c.field),
    autoDisabled: providersToDisable.map((p) => p.provider),
    updatedBy: actor?.id,
  });

  const view = toSafeView(updated);
  await writeSafeCache(provider, view);
  return view;
}

function toAuditValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return value;
}

/**
 * Run the provider's live connectivity check against the STORED credentials.
 *
 * The request body carries a `mode` at most — NEVER a secret. Testing with a
 * secret supplied in the request would validate something other than what the
 * platform will actually transact with, and would put a live credential in an
 * access log. The test always uses what is stored.
 *
 * @param {string} provider
 * @param {"TEST"|"LIVE"} [mode] defaults to the provider's current mode
 * @param {Object} actor `req.user`
 * @param {Object} [reqMeta] `{ ipAddress, userAgent }`
 * @returns {Promise<{ok: boolean, mode: string, message: string, accountHint: (string|null), latencyMs: number}>}
 */
async function testConnection(provider, mode, actor, reqMeta = {}) {
  assertKnownProvider(provider);

  const row = await getOrCreatePlatformConfig(provider, {
    select: { id: true, mode: true },
  });

  const targetMode = mode || row.mode;

  // requireEnabled:false — an admin must be able to verify credentials BEFORE
  // switching the gateway on.
  const config = await resolveConfigForMode(provider, targetMode, {
    requireEnabled: false,
  });

  const impl = getProvider(provider);

  const startedAt = Date.now();
  let ok = false;
  let message = "";
  let accountHint = null;

  try {
    // Providers take ONE destructured options object whose first key is
    // `config` — never positional args. See the PaymentProvider typedef in
    // providerRegistry.js and the reference impl in razorpayProvider.js.
    const result = (await impl.testConnection({ config })) || {};
    ok = result.ok !== false;
    message =
      result.message || (ok ? "Connection successful" : "Connection failed");
    accountHint = result.accountHint ?? null;
  } catch (error) {
    ok = false;
    message = error.message || "Connection failed";
    logger.warn("Payment provider test connection failed", {
      provider,
      mode: targetMode,
      error: error.message,
    });
  }

  const latencyMs = Date.now() - startedAt;

  await prisma.$transaction(async (tx) => {
    await tx.paymentProviderConfig.update({
      where: { id: row.id },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: ok ? "SUCCESS" : "FAILED",
        lastTestMessage: message.slice(0, 1000),
        updatedBy: actor?.id ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actor?.id ?? null,
        action: "PAYMENT_PROVIDER_TESTED",
        resource: "PaymentProviderConfig",
        resourceId: row.id,
        details: {
          provider,
          mode: targetMode,
          ok,
          message,
          accountHint,
          latencyMs,
        },
        ipAddress: reqMeta.ipAddress ?? null,
        userAgent: reqMeta.userAgent ?? null,
      },
    });
  });

  await invalidateConfigCache(provider);

  return { ok, mode: targetMode, message, accountHint, latencyMs };
}

// ---------------------------------------------------------------------------
// Manual top-up policy
// ---------------------------------------------------------------------------

/**
 * Fetch (creating if absent) the platform-level manual top-up policy. Seeded
 * with the Prisma schema defaults so a fresh environment never 404s.
 * @returns {Promise<Object>}
 */
async function getTopupPolicy() {
  const existing = await prisma.walletTopupPolicy.findFirst({
    where: { clientId: null },
  });

  const row =
    existing ||
    (await prisma.walletTopupPolicy
      .create({ data: { clientId: null } })
      .catch(async (error) => {
        const seeded = await prisma.walletTopupPolicy.findFirst({
          where: { clientId: null },
        });
        if (seeded) return seeded;
        throw error;
      }));

  return {
    id: row.id,
    clientId: row.clientId ?? null,
    manualMaxPerTransaction: toNumber(row.manualMaxPerTransaction),
    manualApprovalThreshold: toNumber(row.manualApprovalThreshold),
    manualMaxPerDayPerUser: toNumber(row.manualMaxPerDayPerUser),
    requireReason: row.requireReason,
    requireReference: row.requireReference,
    updatedBy: row.updatedBy ?? null,
    updatedAt: row.updatedAt,
  };
}

/**
 * Update the manual top-up policy.
 * @param {Object} patch validated body
 * @param {Object} actor `req.user`
 * @param {Object} [reqMeta] `{ ipAddress, userAgent }`
 * @returns {Promise<Object>}
 */
async function updateTopupPolicy(patch, actor, reqMeta = {}) {
  const current = await getTopupPolicy();

  const data = { updatedBy: actor?.id ?? null };
  const changedFields = [];

  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    data[field] = value;
    changedFields.push({ field, from: current[field] ?? null, to: value });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.walletTopupPolicy.update({
      where: { id: current.id },
      data,
    });

    await tx.auditLog.create({
      data: {
        userId: actor?.id ?? null,
        action: "WALLET_TOPUP_POLICY_UPDATED",
        resource: "WalletTopupPolicy",
        resourceId: row.id,
        details: { changedFields },
        ipAddress: reqMeta.ipAddress ?? null,
        userAgent: reqMeta.userAgent ?? null,
      },
    });

    return row;
  });

  logger.info("Wallet top-up policy updated", {
    changedFields: changedFields.map((c) => c.field),
    updatedBy: actor?.id,
  });

  return {
    id: updated.id,
    clientId: updated.clientId ?? null,
    manualMaxPerTransaction: toNumber(updated.manualMaxPerTransaction),
    manualApprovalThreshold: toNumber(updated.manualApprovalThreshold),
    manualMaxPerDayPerUser: toNumber(updated.manualMaxPerDayPerUser),
    requireReason: updated.requireReason,
    requireReference: updated.requireReference,
    updatedBy: updated.updatedBy ?? null,
    updatedAt: updated.updatedAt,
  };
}

module.exports = {
  // Constants
  SAFE_SELECT,
  DEFAULT_PROVIDER,
  IMPLEMENTED_PROVIDERS,
  COMING_SOON_PROVIDERS,
  WEBHOOK_EVENTS,

  // Rows / reads
  getOrCreatePlatformConfig,
  listConfigs,
  getConfigSafe,
  getActiveProviderPublic,
  resolveActiveProviderName,

  // Internal credential resolution (plaintext — never return these directly)
  resolveActiveConfig,
  resolveConfigForMode,

  // Writes
  updateConfig,
  testConnection,

  // Policy
  getTopupPolicy,
  updateTopupPolicy,

  // Cache
  invalidateConfigCache,
};
