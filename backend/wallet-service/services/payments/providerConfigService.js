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
 * SAFE-BY-DEFAULT READS
 * ---------------------
 * `SAFE_SELECT` is an explicit Prisma `select` that lists ONLY non-secret
 * columns; every read path that can reach an HTTP response uses it. This
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDER = "razorpay";

/** Providers with a real implementation behind them. */
const IMPLEMENTED_PROVIDERS = ["razorpay"];

/** Listed in the admin UI, greyed out. No DB row is created for these. */
const COMING_SOON_PROVIDERS = ["stripe", "cashfree", "payu"];

const ALL_PROVIDERS = [...IMPLEMENTED_PROVIDERS, ...COMING_SOON_PROVIDERS];

/** Webhook events an operator must subscribe to in the gateway dashboard. */
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
};

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

function buildWebhookUrl(provider) {
  const base = (
    process.env.PAYMENT_PUBLIC_API_URL ||
    process.env.PUBLIC_API_URL ||
    ""
  ).replace(/\/+$/, "");

  return `${base}/api/v1/wallet/topup/webhook/${provider}`;
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
  };

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
    webhookEvents: WEBHOOK_EVENTS,
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
function toSafeView(row) {
  const testKey = describeSecret(row.testKeySecretEnc);
  const testHook = describeSecret(row.testWebhookSecretEnc);
  const liveKey = describeSecret(row.liveKeySecretEnc);
  const liveHook = describeSecret(row.liveWebhookSecretEnc);

  const credentialsUnreadable =
    testKey.unreadable ||
    testHook.unreadable ||
    liveKey.unreadable ||
    liveHook.unreadable;

  const view = {
    provider: row.provider,
    clientId: row.clientId ?? null,
    isEnabled: row.isEnabled,
    mode: row.mode,
    test: {
      keyId: row.testKeyId ?? null,
      keySecretSet: testKey.set,
      keySecretMasked: testKey.masked,
      webhookSecretSet: testHook.set,
    },
    live: {
      keyId: row.liveKeyId ?? null,
      keySecretSet: liveKey.set,
      keySecretMasked: liveKey.masked,
      webhookSecretSet: liveHook.set,
    },
    currency: row.currency,
    minAmount: toNumber(row.minAmount),
    maxAmount: toNumber(row.maxAmount),
    quickAmounts: normalizeQuickAmounts(row.quickAmounts),
    paymentLinkExpiryHours: row.paymentLinkExpiryHours,
    // Computed server-side so the admin can copy-paste it straight into the
    // gateway dashboard instead of hand-assembling the public URL.
    webhookUrl: buildWebhookUrl(row.provider),
    webhookEvents: WEBHOOK_EVENTS,
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
    select: SECRET_SELECT,
    orderBy: { updatedAt: "desc" },
  });

  if (!row) {
    return { enabled: false, provider: null };
  }

  const isLive = row.mode === "LIVE";
  const keyId = isLive ? row.liveKeyId : row.testKeyId;
  const keySecretEnc = isLive ? row.liveKeySecretEnc : row.testKeySecretEnc;

  // Enabled but half-configured (e.g. the key id was cleared out of band):
  // treat as unavailable rather than handing the browser a broken checkout key.
  if (!keyId || !keySecretEnc) {
    logger.warn(
      "Enabled payment provider is missing credentials for its mode",
      {
        provider: row.provider,
        mode: row.mode,
      },
    );
    return { enabled: false, provider: null };
  }

  return {
    enabled: true,
    provider: row.provider,
    mode: row.mode,
    keyId,
    currency: row.currency,
    minAmount: toNumber(row.minAmount),
    maxAmount: toNumber(row.maxAmount),
    quickAmounts: normalizeQuickAmounts(row.quickAmounts),
  };
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
  const keyId = isLive ? row.liveKeyId : row.testKeyId;
  const keySecretEnc = isLive ? row.liveKeySecretEnc : row.testKeySecretEnc;
  const webhookSecretEnc = isLive
    ? row.liveWebhookSecretEnc
    : row.testWebhookSecretEnc;

  const missing = [];
  if (!keyId) missing.push(isLive ? "liveKeyId" : "testKeyId");
  if (!keySecretEnc) missing.push(isLive ? "liveKeySecret" : "testKeySecret");
  if (!webhookSecretEnc) {
    missing.push(isLive ? "liveWebhookSecret" : "testWebhookSecret");
  }

  if (missing.length > 0) {
    throw conflict(
      `Payment provider '${provider}' is missing ${mode} credentials: ${missing.join(", ")}`,
      "PROVIDER_NOT_CONFIGURED",
      { missing, mode },
    );
  }

  const resolved = {
    provider: row.provider,
    mode,
    keyId,
    keySecret: decryptSecret(keySecretEnc),
    webhookSecret: decryptSecret(webhookSecretEnc),
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

  const isLive = nextMode === "LIVE";

  // --- credential merge -----------------------------------------------------
  const testKeyId = resolvePlainPatch(patch.testKeyId, current.testKeyId);
  const liveKeyId = resolvePlainPatch(patch.liveKeyId, current.liveKeyId);
  const testKeySecret = resolveSecretPatch(
    patch.testKeySecret,
    current.testKeySecretEnc,
  );
  const testWebhookSecret = resolveSecretPatch(
    patch.testWebhookSecret,
    current.testWebhookSecretEnc,
  );
  const liveKeySecret = resolveSecretPatch(
    patch.liveKeySecret,
    current.liveKeySecretEnc,
  );
  const liveWebhookSecret = resolveSecretPatch(
    patch.liveWebhookSecret,
    current.liveWebhookSecretEnc,
  );

  const nextEnabled =
    patch.isEnabled === undefined ? current.isEnabled : patch.isEnabled;

  // --- enabling guard -------------------------------------------------------
  // The credential trio must be complete for the mode that WILL be active,
  // counting values already stored. Enabling a gateway with a missing webhook
  // secret would accept unverifiable webhooks — refuse it up front.
  if (nextEnabled) {
    const missing = [];
    const effectiveKeyId = isLive ? liveKeyId.value : testKeyId.value;
    const effectiveKeySecret = isLive
      ? liveKeySecret.value
      : testKeySecret.value;
    const effectiveWebhookSecret = isLive
      ? liveWebhookSecret.value
      : testWebhookSecret.value;

    if (!effectiveKeyId) missing.push(isLive ? "liveKeyId" : "testKeyId");
    if (!effectiveKeySecret) {
      missing.push(isLive ? "liveKeySecret" : "testKeySecret");
    }
    if (!effectiveWebhookSecret) {
      missing.push(isLive ? "liveWebhookSecret" : "testWebhookSecret");
    }

    if (missing.length > 0) {
      const error = new ValidationError(
        `Cannot enable ${provider} in ${nextMode} mode — missing: ${missing.join(", ")}`,
        { missing, mode: nextMode },
      );
      error.code = "PROVIDER_CREDENTIALS_INCOMPLETE";
      throw error;
    }
  }

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

  if (testKeyId.write) {
    data.testKeyId = testKeyId.value;
    // keyId is the PUBLIC checkout key — plaintext by design, safe to audit.
    changedFields.push({
      field: "testKeyId",
      from: current.testKeyId ?? null,
      to: testKeyId.value,
    });
  }
  if (liveKeyId.write) {
    data.liveKeyId = liveKeyId.value;
    changedFields.push({
      field: "liveKeyId",
      from: current.liveKeyId ?? null,
      to: liveKeyId.value,
    });
  }

  const secretWrites = [
    ["testKeySecret", "testKeySecretEnc", testKeySecret],
    ["testWebhookSecret", "testWebhookSecretEnc", testWebhookSecret],
    ["liveKeySecret", "liveKeySecretEnc", liveKeySecret],
    ["liveWebhookSecret", "liveWebhookSecretEnc", liveWebhookSecret],
  ];

  for (const [label, column, patchResult] of secretWrites) {
    if (!patchResult.write) continue;
    data[column] = patchResult.value;
    // NEVER audit the value — only that it changed and whether it was cleared.
    changedFields.push({
      field: label,
      changed: true,
      cleared: patchResult.value === null,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.paymentProviderConfig.update({
      where: { id: current.id },
      data,
      select: SECRET_SELECT,
    });

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

  await invalidateConfigCache(provider);

  logger.info("Payment provider configuration updated", {
    provider,
    mode: updated.mode,
    isEnabled: updated.isEnabled,
    changedFields: changedFields.map((c) => c.field),
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
